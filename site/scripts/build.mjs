// Assembles the GitHub Pages site: the page with the app's version, its assets, and the two installers.
// Usage: node site/scripts/build.mjs [output folder, default _site]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const siteDir = path.join(rootDir, 'site');

// What the page needs; scripts/ and tests/ stay out of the published site
const ASSETS = ['index.html', 'styles.css', 'main.js', 'i18n.js', 'fonts', 'img'];
export const WINDOWS_INSTALLER = 'RaceHubOS-install-win.bat';
export const MAC_INSTALLER = 'RaceHubOS-install-mac.command';
// A .command downloaded on its own loses its execute bit; a zip keeps it
export const MAC_DOWNLOAD = 'RaceHubOS-install-mac.zip';

/**
 * A zip holding one file, marked as made on Unix with the given mode, so that the archive utilities of macOS
 * restore it executable whatever system built it. Dated 1980-01-01, so that the same file gives the same zip.
 */
export function zipFile(name, data, mode) {
  const deflated = zlib.deflateRawSync(data);
  const crc = zlib.crc32(data);
  const nameBytes = Buffer.from(name);
  const DOS_DATE = (1 << 5) | 1;

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4); // version needed: deflate
  local.writeUInt16LE(8, 8); // method: deflate
  local.writeUInt16LE(DOS_DATE, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(deflated.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBytes.length, 26);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE((3 << 8) | 20, 4); // made by Unix, so the mode below is read
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(8, 10);
  central.writeUInt16LE(DOS_DATE, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(deflated.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  central.writeUInt32LE(((0o100000 | mode) << 16) >>> 0, 38); // regular file + permissions
  central.writeUInt32LE(0, 42); // offset of the local header

  const centralOffset = local.length + nameBytes.length + deflated.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + nameBytes.length, 12);
  end.writeUInt32LE(centralOffset, 16);

  return Buffer.concat([local, nameBytes, deflated, central, nameBytes, end]);
}

export function appVersion() {
  return JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8')).version;
}

export function buildSite(outDir) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  for (const asset of ASSETS) {
    fs.cpSync(path.join(siteDir, asset), path.join(outDir, asset), { recursive: true });
  }
  const page = path.join(outDir, 'index.html');
  fs.writeFileSync(page, fs.readFileSync(page, 'utf-8').replaceAll('%VERSION%', appVersion()));

  fs.copyFileSync(path.join(rootDir, WINDOWS_INSTALLER), path.join(outDir, WINDOWS_INSTALLER));
  const installer = fs.readFileSync(path.join(rootDir, MAC_INSTALLER));
  fs.writeFileSync(path.join(outDir, MAC_DOWNLOAD), zipFile(MAC_INSTALLER, installer, 0o755));
  return outDir;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const outDir = path.resolve(process.argv[2] ?? path.join(rootDir, '_site'));
  buildSite(outDir);
  console.log(`Site built in ${outDir}`);
}
