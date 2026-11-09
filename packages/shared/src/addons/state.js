import fs from 'fs';
import path from 'path';

/**
 * Where add-ons live — docs/ADDONS.md § Folder layout.
 * `addons/.data/` survives core and add-on updates: it holds the data and the state.
 */
export function addonPaths(rootDir) {
  const addonsDir = path.join(rootDir, 'addons');
  const dataDir = path.join(addonsDir, '.data');
  return {
    addonsDir,
    dataDir,
    stateFile: path.join(dataDir, 'state.json'),
    catalogFile: path.join(addonsDir, 'catalog.json'),
  };
}

const emptyState = () => ({ disabled: {}, installed: {} });

/**
 * `disabled`: { [id]: { reason, at } } — set by the user or after a crash.
 * `installed`: { [id]: { source, repo, ref, at } } — absent for a developer's folder.
 */
export function readState(rootDir) {
  try {
    const raw = JSON.parse(fs.readFileSync(addonPaths(rootDir).stateFile, 'utf-8'));
    return { disabled: { ...raw.disabled }, installed: { ...raw.installed } };
  } catch {
    // A missing or damaged state must never stop the app: every add-on is then enabled
    return emptyState();
  }
}

export function writeState(rootDir, state) {
  const { dataDir, stateFile } = addonPaths(rootDir);
  fs.mkdirSync(dataDir, { recursive: true });
  // Write then rename, so a crash mid-write never leaves a truncated file
  const tmp = `${stateFile}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n');
  fs.renameSync(tmp, stateFile);
}

function updateState(rootDir, change) {
  const state = readState(rootDir);
  change(state);
  writeState(rootDir, state);
  return state;
}

export function disableAddon(rootDir, id, reason = '') {
  return updateState(rootDir, (state) => {
    state.disabled[id] = { reason: String(reason), at: new Date().toISOString() };
  });
}

export function enableAddon(rootDir, id) {
  return updateState(rootDir, (state) => {
    delete state.disabled[id];
  });
}

export function recordInstall(rootDir, id, info) {
  return updateState(rootDir, (state) => {
    state.installed[id] = { ...info, at: new Date().toISOString() };
  });
}

export function forgetAddon(rootDir, id) {
  return updateState(rootDir, (state) => {
    delete state.installed[id];
    delete state.disabled[id];
  });
}
