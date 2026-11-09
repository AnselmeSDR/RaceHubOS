import fs from 'fs';
import path from 'path';
import { DEFAULT_ORDER, MANIFEST_FILE, validateManifest } from './manifest.js';
import { addonPaths, readState } from './state.js';

function existing(dir, ...candidates) {
  for (const candidate of candidates) {
    const file = path.join(dir, candidate);
    if (fs.existsSync(file)) return file;
  }
  return null;
}

function readManifest(dir, folder) {
  const file = path.join(dir, MANIFEST_FILE);
  if (!fs.existsSync(file)) return { manifest: null, errors: [`missing ${MANIFEST_FILE}`] };
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (err) {
    return { manifest: null, errors: [`${MANIFEST_FILE} is not valid JSON: ${err.message}`] };
  }
  return validateManifest(raw, folder);
}

/** Stack order: `order` first (lower is closer to the core), then id — docs/ADDONS.md § Stacking. */
export function compareAddons(a, b) {
  const byOrder = (a.manifest?.order ?? DEFAULT_ORDER) - (b.manifest?.order ?? DEFAULT_ORDER);
  if (byOrder !== 0) return byOrder;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Every folder in `addons/`, valid or not, sorted in stack order.
 * Folders starting with a dot (`.data`) are not add-ons.
 */
export function discoverAddons(rootDir) {
  const { addonsDir } = addonPaths(rootDir);
  let folders;
  try {
    folders = fs
      .readdirSync(addonsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => entry.name);
  } catch {
    return [];
  }

  const state = readState(rootDir);
  return folders
    .map((folder) => {
      const dir = path.join(addonsDir, folder);
      const { manifest, errors } = readManifest(dir, folder);
      const disabled = state.disabled[folder];
      return {
        id: folder,
        dir,
        manifest,
        errors,
        valid: errors.length === 0,
        enabled: errors.length === 0 && !disabled,
        disabledReason: disabled ? disabled.reason : null,
        // null for a folder put there by hand: the app never updates or removes it
        installed: state.installed[folder] ?? null,
        serverEntry: existing(dir, 'server/index.js'),
        webEntry: existing(dir, 'web/index.jsx', 'web/index.js'),
        localesDir: existing(dir, 'web/locales'),
        overridesDir: existing(dir, 'overrides'),
        hasPackageJson: existing(dir, 'package.json') !== null,
      };
    })
    .sort(compareAddons);
}

/** The add-ons the app loads: valid and not disabled, in stack order. */
export function enabledAddons(rootDir) {
  return discoverAddons(rootDir).filter((addon) => addon.enabled);
}
