import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

const read = (name) => fs.readFileSync(path.join(rootDir, name), 'utf-8');
const declaredVersion = (text, prefix) =>
  text.split('\n').find((l) => l.startsWith(`${prefix} INSTALLER_VERSION`))?.split(/\s+/)[2];

/**
 * The installer sitting on the desktop is a frozen copy. The one on the race PC
 * was five months old and still copied the previous install's whole prisma
 * folder over the new one, which put a schema.prisma Prisma 7 rejects into a
 * brand new version and stopped the app from starting. It now replaces itself
 * before doing anything — a mechanism only its own file can carry, so these
 * tests guard it.
 */
describe('installers', () => {
  const installers = [
    ['RaceHubOS-install-win.bat', '::'],
    ['RaceHubOS-install-mac.command', '#'],
  ];

  it.each(installers)('%s declares a whole-number version', (name, prefix) => {
    const version = declaredVersion(read(name), prefix);
    expect(version).toMatch(/^\d+$/);
  });

  it.each(installers)('%s self-updates from its own file on main', (name) => {
    const text = read(name);
    expect(text).toContain(`https://raw.githubusercontent.com/AnselmeSDR/RaceHubOS/main/${name}`);
    // Without this guard a fresh copy would download and relaunch forever
    expect(text).toContain('--updated');
  });

  it('the macOS installer is valid bash', () => {
    expect(() => execFileSync('bash', ['-n', path.join(rootDir, 'RaceHubOS-install-mac.command')],
      { stdio: 'pipe' })).not.toThrow();
  });

  /**
   * cmd.exe reads a parenthesised block whole before running it, and refuses a
   * `::` label inside one. Neither mistake shows up on macOS, where the file
   * cannot be run at all — only on the race PC, mid-install.
   */
  it('the Windows installer has balanced blocks and no :: inside one', () => {
    const offenders = [];
    let depth = 0;

    for (const [index, raw] of read('RaceHubOS-install-win.bat').split('\n').entries()) {
      const line = raw.trim();
      if (depth > 0 && line.startsWith('::')) offenders.push(index + 1);
      if (line.startsWith('::') || line.toLowerCase().startsWith('rem ')) continue;
      const code = line.replace(/"[^"]*"/g, '');
      depth += (code.match(/\(/g) ?? []).length - (code.match(/\)/g) ?? []).length;
    }

    expect(offenders).toEqual([]);
    expect(depth).toBe(0);
  });
});
