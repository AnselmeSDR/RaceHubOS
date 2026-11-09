import fs from 'fs';
import { ADDON_ID_PATTERN, addonPaths } from '@racehubos/shared/addons';

/** Read from main on GitHub, so adding an add-on to the catalog needs no RaceHubOS release. */
export const CATALOG_URL = 'https://raw.githubusercontent.com/AnselmeSDR/RaceHubOS/main/addons/catalog.json';

const text = (value) => (typeof value === 'string' && value ? value : null);
// git gets links and refs as arguments: never an option, never spaces
const gitArgument = (value) => Boolean(text(value)) && !value.startsWith('-') && !/\s/.test(value);

/** Valid entries of a catalog, the first one winning on a repeated id. */
export function parseCatalog(raw) {
  const seen = new Set();
  const entries = Array.isArray(raw?.addons) ? raw.addons : [];
  return entries
    .filter((entry) => typeof entry?.id === 'string' && ADDON_ID_PATTERN.test(entry.id))
    .filter((entry) => gitArgument(entry.repo) && (entry.ref === undefined || gitArgument(entry.ref)))
    .filter((entry) => !seen.has(entry.id) && seen.add(entry.id))
    .map((entry) => ({
      id: entry.id,
      repo: entry.repo,
      ref: text(entry.ref),
      name: entry.name ?? entry.id,
      description: entry.description ?? null,
    }));
}

/**
 * The maintainer's catalog: from GitHub, the local copy when offline.
 * `RACEHUBOS_CATALOG_URL` replaces the address; empty, only the local copy is read (tests).
 *
 * @returns {Promise<{ source: 'remote'|'local'|'none', addons: Array }>}
 */
export async function readCatalog(
  rootDir,
  { url = process.env.RACEHUBOS_CATALOG_URL ?? CATALOG_URL, fetchImpl = fetch, timeout = 5000 } = {}
) {
  if (url) {
    try {
      const response = await fetchImpl(url, {
        signal: AbortSignal.timeout(timeout),
        headers: { 'User-Agent': 'RaceHubOS' },
      });
      if (response.ok) return { source: 'remote', addons: parseCatalog(await response.json()) };
    } catch {
      // offline or GitHub down: the copy shipped with the app
    }
  }
  try {
    const raw = JSON.parse(fs.readFileSync(addonPaths(rootDir).catalogFile, 'utf-8'));
    return { source: 'local', addons: parseCatalog(raw) };
  } catch {
    return { source: 'none', addons: [] };
  }
}
