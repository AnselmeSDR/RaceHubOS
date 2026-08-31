import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Bootstrap for the installer's self-update.
 *
 * The installer replaces itself before doing anything — but only from version 2
 * on. Installers already sitting on desktops predate that block and can never
 * acquire it on their own: the race PC still had the one from 15/04, which
 * copied the previous install's whole prisma folder over the new one and put a
 * schema.prisma Prisma 7 rejects into a brand new version.
 *
 * So the app drops a current installer on the desktop after each successful
 * update. Once one lands, the self-update takes over and this only ever
 * confirms the file is already current.
 */

/** Installer shipped for this platform, or null where none applies. */
export function installerName(platform = process.platform) {
  if (platform === 'win32') return 'RaceHubOS-install-win.bat';
  if (platform === 'darwin') return 'RaceHubOS-install-mac.command';
  return null;
}

/**
 * The user's desktop. OneDrive relocates it, and Windows localises it, so the
 * plain path is not enough — writing to a stale ~/Desktop would leave the icon
 * the user actually double-clicks untouched.
 */
export function findDesktop(homeDir = os.homedir()) {
  const candidates = [
    path.join(homeDir, 'OneDrive', 'Desktop'),
    path.join(homeDir, 'OneDrive', 'Bureau'),
    path.join(homeDir, 'Desktop'),
    path.join(homeDir, 'Bureau'),
  ];
  return candidates.find((dir) => fs.existsSync(dir)) ?? null;
}

/**
 * Copy the repository's installer onto the desktop.
 *
 * @returns {{ copied: boolean, target?: string, reason?: string }}
 */
export function refreshDesktopInstaller({ rootDir, homeDir = os.homedir(), platform = process.platform } = {}) {
  const name = installerName(platform);
  if (!name) return { copied: false, reason: 'platform' };

  const source = path.join(rootDir, name);
  if (!fs.existsSync(source)) return { copied: false, reason: 'source-missing' };

  const desktop = findDesktop(homeDir);
  if (!desktop) return { copied: false, reason: 'desktop-missing' };

  const target = path.join(desktop, name);
  const shipped = fs.readFileSync(source);
  if (fs.existsSync(target) && fs.readFileSync(target).equals(shipped)) {
    return { copied: false, target, reason: 'already-current' };
  }

  fs.writeFileSync(target, shipped);
  // The macOS installer is double-clicked, so it has to stay executable
  if (platform === 'darwin') fs.chmodSync(target, 0o755);
  return { copied: true, target };
}
