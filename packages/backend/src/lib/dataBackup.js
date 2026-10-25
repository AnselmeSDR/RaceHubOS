import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const quote = (name) => '"' + name.replaceAll('"', '""') + '"';
const imageName = /^(drivers|cars|tracks|teams)\/[a-zA-Z0-9_. -]+\.(png|jpe?g|webp|gif)$/i;
const MAX_BYTES = 30 * 1024 * 1024;
function schema(db) {
  return db
    .prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all();
}
function idle(db) {
  const table = db.prepare("SELECT name FROM sqlite_master WHERE name='Session'").get();
  if (table && db.prepare("SELECT COUNT(*) AS n FROM Session WHERE status IN ('active','paused','finishing')").get().n)
    throw new Error('Bitte zuerst alle laufenden oder pausierten Sitzungen beenden.');
}
function snapshotFiles(root) {
  const result = [];
  let bytes = 0;
  if (!fs.existsSync(root)) return result;
  for (const type of ['drivers', 'cars', 'tracks', 'teams']) {
    const directory = path.join(root, type);
    if (!fs.existsSync(directory)) continue;
    if (fs.lstatSync(directory).isSymbolicLink()) throw new Error('Bildordner darf keine Verknüpfung sein.');
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const name = `${type}/${entry.name}`;
      if (!imageName.test(name) || entry.name.includes('..')) continue;
      const data = fs.readFileSync(path.join(directory, entry.name));
      bytes += data.length;
      if (bytes > MAX_BYTES) throw new Error('Bildbestand überschreitet die Sicherungsgrenze von 30 MB.');
      result.push({ name, data: data.toString('base64'), checksum: hash(data) });
    }
  }
  return result;
}
export function createBackup(databasePath, uploadsPath) {
  const db = new Database(databasePath, { readonly: true });
  try {
    return db.transaction(() => {
      idle(db);
      const definitions = schema(db),
        tables = {};
      for (const { name } of definitions) {
        const columns = db
          .prepare(`PRAGMA table_info(${quote(name)})`)
          .all()
          .map((c) => c.name);
        tables[name] = {
          columns,
          rows: db
            .prepare(`SELECT * FROM ${quote(name)}`)
            .raw()
            .all(),
        };
      }
      const payload = {
        createdAt: new Date().toISOString(),
        schema: hash(JSON.stringify(definitions)),
        tables,
        images: snapshotFiles(uploadsPath),
      };
      return { format: 'RaceHubOS-Datensicherung', version: 1, checksum: hash(JSON.stringify(payload)), payload };
    })();
  } finally {
    db.close();
  }
}
function writeRows(db, backup) {
  for (const name of Object.keys(backup.payload.tables)) db.prepare(`DELETE FROM ${quote(name)}`).run();
  for (const [name, table] of Object.entries(backup.payload.tables)) {
    const insert = db.prepare(
      `INSERT INTO ${quote(name)} (${table.columns.map(quote).join(',')}) VALUES (${table.columns.map(() => '?').join(',')})`
    );
    for (const row of table.rows) insert.run(...row);
  }
  if (db.prepare('PRAGMA foreign_key_check').all().length)
    throw new Error('Die Sicherung enthält ungültige Datenverknüpfungen.');
}
export function validateBackup(databasePath, backup) {
  if (
    backup?.format !== 'RaceHubOS-Datensicherung' ||
    backup.version !== 1 ||
    !backup.payload ||
    backup.checksum !== hash(JSON.stringify(backup.payload))
  )
    throw new Error(
      'Keine gültige RaceHubOS-Sicherung oder Prüfsumme beschädigt. Cockpit-XP bitte über die Datenübernahme öffnen.'
    );
  const db = new Database(databasePath, { readonly: true });
  try {
    const definitions = schema(db),
      payload = backup.payload;
    if (payload.schema !== hash(JSON.stringify(definitions)))
      throw new Error('Die Datenbankstruktur passt nicht zu dieser RaceHubOS-Version.');
    if (
      !payload.tables ||
      JSON.stringify(Object.keys(payload.tables).sort()) !== JSON.stringify(definitions.map((d) => d.name).sort())
    )
      throw new Error('Sicherung ist unvollständig.');
    for (const { name } of definitions) {
      const table = payload.tables[name],
        columns = db
          .prepare(`PRAGMA table_info(${quote(name)})`)
          .all()
          .map((c) => c.name);
      if (
        JSON.stringify(table.columns) !== JSON.stringify(columns) ||
        !Array.isArray(table.rows) ||
        table.rows.length > 1000000
      )
        throw new Error('Ungültige Tabellenstruktur.');
      for (const row of table.rows)
        if (
          !Array.isArray(row) ||
          row.length !== columns.length ||
          row.some((v) => v !== null && typeof v !== 'string' && !(typeof v === 'number' && Number.isFinite(v)))
        )
          throw new Error('Ungültiger Datenwert in Sicherung.');
    }
    const sessions = payload.tables.Session;
    if (
      sessions &&
      sessions.rows.some((row) => ['active', 'paused', 'finishing'].includes(row[sessions.columns.indexOf('status')]))
    )
      throw new Error(
        'Sicherung enthält eine noch laufende Sitzung. Diese kann nicht als laufendes Rennen wiederhergestellt werden.'
      );
    if (!Array.isArray(payload.images) || payload.images.length > 10000) throw new Error('Ungültige Bilderliste.');
    let bytes = 0;
    const seen = new Set();
    for (const image of payload.images) {
      if (
        !imageName.test(image.name) ||
        image.name.includes('..') ||
        seen.has(image.name) ||
        typeof image.data !== 'string' ||
        !/^[A-Za-z0-9+/]*={0,2}$/.test(image.data)
      )
        throw new Error('Ungültiger Bildpfad oder Bildinhalt.');
      const data = Buffer.from(image.data, 'base64');
      bytes += data.length;
      if (bytes > MAX_BYTES || hash(data) !== image.checksum) throw new Error('Bilddatei beschädigt oder zu groß.');
      seen.add(image.name);
    }
    // Test constraints against a private in-memory clone, never against the live data.
    const serialized = db.serialize();
    // A deserialized private database has no WAL sidecar. Use rollback-journal
    // header flags for this in-memory validation copy, preserving the live file.
    serialized[18] = 1;
    serialized[19] = 1;
    const clone = new Database(serialized);
    try {
      clone.pragma('foreign_keys = OFF');
      clone.transaction(() => writeRows(clone, backup))();
    } finally {
      clone.close();
    }
    return {
      createdAt: payload.createdAt,
      images: payload.images.length,
      counts: Object.fromEntries(
        Object.entries(payload.tables)
          .filter(([name]) => !name.startsWith('_'))
          .map(([name, value]) => [name, value.rows.length])
      ),
    };
  } finally {
    db.close();
  }
}
export function restoreBackup(databasePath, uploadsPath, backup) {
  validateBackup(databasePath, backup);
  // URL-derived paths can end in '/'; staging must be a sibling, never a child.
  // Follow the package launcher's persistent uploads link, keeping it intact.
  uploadsPath = path.resolve(uploadsPath);
  if (fs.existsSync(uploadsPath)) uploadsPath = fs.realpathSync(uploadsPath);
  const db = new Database(databasePath),
    stage = uploadsPath + '.restore-' + randomUUID(),
    old = uploadsPath + '.previous-' + randomUUID();
  let moved = false,
    installed = false;
  try {
    idle(db);
    fs.mkdirSync(stage, { recursive: true });
    for (const image of backup.payload.images) {
      const target = path.join(stage, image.name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, Buffer.from(image.data, 'base64'));
    }
    db.pragma('foreign_keys = OFF');
    db.transaction(() => {
      idle(db);
      writeRows(db, backup);
      if (fs.existsSync(uploadsPath)) {
        fs.renameSync(uploadsPath, old);
        moved = true;
      }
      fs.renameSync(stage, uploadsPath);
      installed = true;
    })();
    // Keep previous images as an extra recovery copy; route also keeps full pre-restore backup.
    return { previousImages: moved ? path.basename(old) : null };
  } catch (error) {
    if (installed) fs.rmSync(uploadsPath, { recursive: true, force: true });
    if (moved && fs.existsSync(old)) fs.renameSync(old, uploadsPath);
    throw error;
  } finally {
    db.close();
    if (fs.existsSync(stage)) fs.rmSync(stage, { recursive: true, force: true });
  }
}
