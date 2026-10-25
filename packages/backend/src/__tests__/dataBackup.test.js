import { test } from '@jest/globals';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import { createBackup, validateBackup, restoreBackup } from '../lib/dataBackup.js';
test('backup roundtrip restores rows, preferences and images, invalid files never touch current data', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'racehub-backup-test-'));
  const dbPath = path.join(directory, 'test.db'),
    images = path.join(directory, 'uploads');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  try {
    db.exec(
      "PRAGMA foreign_keys=ON; CREATE TABLE Driver(id TEXT PRIMARY KEY, name TEXT NOT NULL); CREATE TABLE Session(id TEXT PRIMARY KEY, status TEXT); CREATE TABLE Lap(id TEXT PRIMARY KEY, driverId TEXT REFERENCES Driver(id)); CREATE TABLE Preference(key TEXT PRIMARY KEY, value TEXT); INSERT INTO Driver VALUES ('a','Änne'); INSERT INTO Session VALUES ('s','finished'); INSERT INTO Lap VALUES ('l','a'); INSERT INTO Preference VALUES ('layout','{\"color\":\"#ff0000\"}');"
    );
    fs.mkdirSync(path.join(images, 'drivers'), { recursive: true });
    fs.writeFileSync(path.join(images, 'drivers', 'a.png'), Buffer.from([1, 2, 3]));
    const backup = createBackup(dbPath, images);
    assert.equal(validateBackup(dbPath, backup).counts.Driver, 1);
    db.prepare('UPDATE Driver SET name=?').run('Geändert');
    fs.writeFileSync(path.join(images, 'drivers', 'a.png'), 'geändert');
    restoreBackup(dbPath, images + path.sep, backup);
    assert.equal(db.prepare('SELECT name FROM Driver').get().name, 'Änne');
    assert.deepEqual(fs.readFileSync(path.join(images, 'drivers', 'a.png')), Buffer.from([1, 2, 3]));
    assert.equal(db.prepare('SELECT value FROM Preference').get().value, '{"color":"#ff0000"}');
    const persistentLink = path.join(directory, 'linked-uploads');
    fs.symlinkSync(images, persistentLink, 'dir');
    fs.writeFileSync(path.join(images, 'drivers', 'a.png'), 'erneut geändert');
    restoreBackup(dbPath, persistentLink + path.sep, backup);
    assert.ok(fs.lstatSync(persistentLink).isSymbolicLink());
    assert.deepEqual(fs.readFileSync(path.join(images, 'drivers', 'a.png')), Buffer.from([1, 2, 3]));
    const corrupted = structuredClone(backup);
    corrupted.payload.tables.Driver.rows[0][1] = 'Falsch';
    assert.throws(() => restoreBackup(dbPath, images, corrupted), /Prüfsumme/);
    const brokenLink = structuredClone(backup);
    brokenLink.payload.tables.Lap.rows[0][1] = 'missing';
    brokenLink.checksum = createHash('sha256').update(JSON.stringify(brokenLink.payload)).digest('hex');
    assert.throws(() => restoreBackup(dbPath, images, brokenLink), /Datenverknüpfungen/);
    const badPath = structuredClone(backup);
    badPath.payload.images[0].name = 'drivers/../../escape.png';
    badPath.checksum = createHash('sha256').update(JSON.stringify(badPath.payload)).digest('hex');
    assert.throws(() => restoreBackup(dbPath, images, badPath), /Bildpfad/);
    assert.equal(db.prepare('SELECT name FROM Driver').get().name, 'Änne');
    db.prepare("UPDATE Session SET status='paused'").run();
    assert.throws(() => restoreBackup(dbPath, images, backup), /Sitzungen beenden/);
  } finally {
    db.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
