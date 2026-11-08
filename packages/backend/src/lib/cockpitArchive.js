import Database from 'better-sqlite3';
import JSZip from 'jszip';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const MAX_ROWS = 5000;
async function readMember(member, limit) {
  if (member._data?.uncompressedSize > limit) throw new Error('Archive member is too large');
  const chunks = [];
  let bytes = 0;
  const stream = member.nodeStream('nodebuffer');
  await new Promise((resolve, reject) => {
    stream.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > limit) {
        stream.pause();
        stream.destroy();
        reject(new Error('Archive member is too large'));
        return;
      }
      chunks.push(chunk);
    });
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  return Buffer.concat(chunks);
}
function memberName(member) {
  return member.name.replaceAll('\\', '/').toLowerCase();
}
async function databaseRows(zip, suffix, tables, directory, required) {
  const members = Object.values(zip.files).filter(
    (item) => !item.dir && memberName(item).endsWith('database.sqlite/' + suffix)
  );
  if (!members.length && !required) return {};
  if (members.length !== 1) throw new Error('Missing or ambiguous Cockpit-XP SQLite database');
  const file = path.join(directory, suffix + '.sqlite');
  await fs.writeFile(file, await readMember(members[0], 50 * 1024 * 1024), { mode: 0o600, flag: 'wx' });
  const db = new Database(file, { readonly: true, fileMustExist: true });
  try {
    db.pragma('trusted_schema = OFF');
    db.pragma('query_only = ON');
    if (db.pragma('quick_check', { simple: true }) !== 'ok') throw new Error('Damaged Cockpit-XP database');
    const existing = new Set(
      db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all()
        .map((row) => row.name)
    );
    const result = {};
    for (const table of tables) {
      result[table] = existing.has(table) ? db.prepare(`SELECT * FROM "${table}" LIMIT ${MAX_ROWS + 1}`).all() : [];
      if (result[table].length > MAX_ROWS) throw new Error('Too many source rows');
    }
    if (required && !['DriverItems', 'CarItems', 'CourseItems'].every((name) => existing.has(name)))
      throw new Error('Unsupported Cockpit-XP database schema');
    return result;
  } finally {
    db.close();
  }
}
/** Only whitelisted SQLite tables and referenced pictures are read. No archive path is extracted. */
export async function readCockpitArchive(buffer) {
  const zip = await JSZip.loadAsync(buffer, { createFolders: false });
  const members = Object.values(zip.files);
  if (members.length > 20000) throw new Error('Too many archive members');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'racehub-cockpit-'));
  try {
    const master = await databaseRows(
      zip,
      'cpv2stamm',
      ['DriverItems', 'CarItems', 'CourseItems', 'CarData'],
      directory,
      true
    );
    const history = await databaseRows(zip, 'cpv2statistik', ['StRennResults', 'StRoundTime'], directory, false);
    const pictures = new Map();
    for (const member of members) {
      if (member.dir || !('/' + memberName(member)).includes('/bilder/')) continue;
      const key = path.posix.basename(memberName(member));
      if (!/\.(png|jpe?g|gif|webp)$/.test(key)) continue;
      if (pictures.has(key)) throw new Error('Ambiguous image filename');
      pictures.set(key, member);
    }
    const images = {};
    let imageBytes = 0;
    for (const row of [...master.DriverItems, ...master.CarItems, ...master.CourseItems]) {
      const name = path.posix.basename(String(row.Picture || '').replaceAll('\\', '/')).toLowerCase();
      const member = pictures.get(name);
      if (!member || images[name]) continue;
      const data = await readMember(member, 5 * 1024 * 1024);
      imageBytes += data.length;
      if (imageBytes > 25 * 1024 * 1024) throw new Error('Too many image bytes');
      const extension = path.posix.extname(name);
      const hex = data.subarray(0, 12).toString('hex');
      const valid =
        extension === '.png'
          ? hex.startsWith('89504e470d0a1a0a')
          : ['.jpg', '.jpeg'].includes(extension)
            ? hex.startsWith('ffd8ff')
            : extension === '.gif'
              ? hex.startsWith('47494638')
              : hex.startsWith('52494646') && data.subarray(8, 12).toString() === 'WEBP';
      if (!valid) throw new Error('Invalid picture format');
      images[name] = { extension, data: data.toString('base64') };
    }
    return { ...master, ...history, images };
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}
