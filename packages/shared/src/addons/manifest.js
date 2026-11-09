/**
 * The add-on manifest (`racehubos-addon.json`) and its rules — docs/ADDONS.md § Manifest.
 */

export const MANIFEST_FILE = 'racehubos-addon.json';
export const DEFAULT_ORDER = 100;

// Lowercase kebab-case: it becomes an API prefix, a translation namespace and a folder name
export const ADDON_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

/** A non-empty string, or a non-empty object of non-empty strings (one per language). */
export function isLocalizedText(value) {
  if (typeof value === 'string') return value.trim() !== '';
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const texts = Object.values(value);
  return texts.length > 0 && texts.every((text) => typeof text === 'string' && text.trim() !== '');
}

/**
 * Check a parsed manifest.
 *
 * @param {unknown} raw parsed JSON
 * @param {string} [folderName] the add-on folder, which the id must match
 * @returns {{ manifest: object|null, errors: string[] }} `manifest` is null when there are errors
 */
export function validateManifest(raw, folderName) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { manifest: null, errors: ['the manifest must be a JSON object'] };
  }

  const errors = [];
  const { id, name, version, description, order = DEFAULT_ORDER } = raw;

  if (typeof id !== 'string' || !ADDON_ID_PATTERN.test(id)) {
    errors.push('id must be lowercase kebab-case (e.g. "track-planner")');
  } else if (folderName !== undefined && id !== folderName) {
    errors.push(`id "${id}" must match the folder name "${folderName}"`);
  }
  if (!isLocalizedText(name)) errors.push('name is required: a string or { "en": "…", "fr": "…" }');
  if (typeof version !== 'string' || !SEMVER.test(version)) errors.push('version must be semver (e.g. "1.2.0")');
  if (description !== undefined && !isLocalizedText(description)) {
    errors.push('description must be a string or { "en": "…", "fr": "…" }');
  }
  if (typeof order !== 'number' || !Number.isFinite(order)) errors.push('order must be a number');

  return { manifest: errors.length ? null : { ...raw, order }, errors };
}
