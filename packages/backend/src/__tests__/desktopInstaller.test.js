import fs from 'fs';
import os from 'os';
import path from 'path';
import { findDesktop, installerName, refreshDesktopInstaller } from '../lib/desktopInstaller.js';

/**
 * Installers already on desktops predate the self-update block and can never
 * acquire it on their own, so the app drops a current one after each update.
 */
describe('desktop installer', () => {
  let workDir;
  let rootDir;
  let homeDir;

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'racehubos-desktop-'));
    rootDir = path.join(workDir, 'repo');
    homeDir = path.join(workDir, 'home');
    fs.mkdirSync(rootDir);
    fs.mkdirSync(homeDir);
    fs.writeFileSync(path.join(rootDir, 'RaceHubOS-install-win.bat'), ':: INSTALLER_VERSION 2\n');
    fs.writeFileSync(path.join(rootDir, 'RaceHubOS-install-mac.command'), '# INSTALLER_VERSION 2\n');
  });

  afterEach(() => fs.rmSync(workDir, { recursive: true, force: true }));

  it('names the installer for each platform', () => {
    expect(installerName('win32')).toBe('RaceHubOS-install-win.bat');
    expect(installerName('darwin')).toBe('RaceHubOS-install-mac.command');
    expect(installerName('linux')).toBeNull();
  });

  it('prefers the OneDrive desktop, which is the one the user sees', () => {
    fs.mkdirSync(path.join(homeDir, 'Desktop'));
    fs.mkdirSync(path.join(homeDir, 'OneDrive', 'Desktop'), { recursive: true });

    expect(findDesktop(homeDir)).toBe(path.join(homeDir, 'OneDrive', 'Desktop'));
  });

  it('finds a localised desktop', () => {
    fs.mkdirSync(path.join(homeDir, 'Bureau'));

    expect(findDesktop(homeDir)).toBe(path.join(homeDir, 'Bureau'));
  });

  it('replaces an outdated installer on the desktop', () => {
    const desktop = path.join(homeDir, 'Desktop');
    fs.mkdirSync(desktop);
    const target = path.join(desktop, 'RaceHubOS-install-win.bat');
    fs.writeFileSync(target, 'installeur du 15/04, sans auto-mise a jour\n');

    const result = refreshDesktopInstaller({ rootDir, homeDir, platform: 'win32' });

    expect(result.copied).toBe(true);
    expect(fs.readFileSync(target, 'utf-8')).toContain('INSTALLER_VERSION 2');
  });

  it('drops one on a desktop that has none', () => {
    fs.mkdirSync(path.join(homeDir, 'Desktop'));

    const result = refreshDesktopInstaller({ rootDir, homeDir, platform: 'win32' });

    expect(result.copied).toBe(true);
    expect(fs.existsSync(path.join(homeDir, 'Desktop', 'RaceHubOS-install-win.bat'))).toBe(true);
  });

  it('leaves an already current installer alone', () => {
    const desktop = path.join(homeDir, 'Desktop');
    fs.mkdirSync(desktop);
    fs.copyFileSync(path.join(rootDir, 'RaceHubOS-install-win.bat'), path.join(desktop, 'RaceHubOS-install-win.bat'));

    const result = refreshDesktopInstaller({ rootDir, homeDir, platform: 'win32' });

    expect(result).toMatchObject({ copied: false, reason: 'already-current' });
  });

  it('keeps the macOS installer executable, since it is double-clicked', () => {
    fs.mkdirSync(path.join(homeDir, 'Desktop'));

    refreshDesktopInstaller({ rootDir, homeDir, platform: 'darwin' });

    const target = path.join(homeDir, 'Desktop', 'RaceHubOS-install-mac.command');
    expect(fs.statSync(target).mode & 0o111).toBeTruthy();
  });

  it('does nothing when there is no desktop to write to', () => {
    const result = refreshDesktopInstaller({ rootDir, homeDir, platform: 'win32' });

    expect(result).toEqual({ copied: false, reason: 'desktop-missing' });
  });
});
