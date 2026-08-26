/**
 * Semantic version comparison (major.minor.patch with optional pre-release).
 * Used to decide whether the remote release is actually newer than the local
 * one — a plain string inequality would also flag older versions as updates.
 */

function parse(version) {
  const [core, prerelease = null] = String(version).trim().replace(/^v/, '').split('-');
  const [major = 0, minor = 0, patch = 0] = core.split('.').map((n) => parseInt(n, 10) || 0);
  return { major, minor, patch, prerelease };
}

function comparePrerelease(a, b) {
  // Per semver: a release outranks a pre-release of the same core version
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
}

/** @returns -1 if a < b, 0 if equal, 1 if a > b */
export function compareVersions(a, b) {
  const va = parse(a);
  const vb = parse(b);

  for (const part of ['major', 'minor', 'patch']) {
    if (va[part] !== vb[part]) return va[part] < vb[part] ? -1 : 1;
  }

  return comparePrerelease(va.prerelease, vb.prerelease);
}

/** True only when `candidate` is strictly newer than `current`. */
export function isNewerVersion(candidate, current) {
  if (!candidate || !current) return false;
  return compareVersions(candidate, current) > 0;
}
