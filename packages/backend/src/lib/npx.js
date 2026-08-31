/**
 * The npx binary, named for the platform.
 *
 * On Windows npx is a .cmd, and execFileSync does not resolve that extension:
 * passing plain 'npx' fails with ENOENT. Nothing shows on macOS or Linux, so
 * the mistake only surfaces on the race PC, mid-migration — which is exactly
 * where it surfaced.
 *
 * execSync and exec go through a shell and resolve it themselves; only the
 * execFile / spawn family needs this.
 */
export const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';
