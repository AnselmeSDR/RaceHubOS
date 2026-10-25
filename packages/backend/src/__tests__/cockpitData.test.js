import { test } from '@jest/globals';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { insertCockpitData } from '../lib/cockpitData.js';
test('Cockpit import adds data with images; failure rolls back rows and new files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'racehub-cockpit-test-')),
    database = path.join(root, 'db.sqlite'),
    uploads = path.join(root, 'images');
  const db = new Database(database);
  try {
    db.exec(
      'CREATE TABLE Driver(id TEXT PRIMARY KEY, name TEXT NOT NULL, img TEXT, createdAt INTEGER, updatedAt INTEGER); CREATE TABLE Car(id TEXT PRIMARY KEY, brand TEXT, model TEXT NOT NULL, notes TEXT, img TEXT, createdAt INTEGER, updatedAt INTEGER); CREATE TABLE Track(id TEXT PRIMARY KEY, name TEXT NOT NULL, img TEXT, createdAt INTEGER, updatedAt INTEGER)'
    );
    const plan = {
      drivers: [{ name: 'Änne', image: { extension: '.png', data: Buffer.from([1, 2]).toString('base64') } }],
      cars: [{ name: "Porsche'); DROP TABLE Driver;--", brand: 'Carrera', notes: 'Originaldaten' }],
      tracks: [{ name: 'Testbahn' }],
    };
    insertCockpitData(database, uploads, plan);
    assert.equal(db.prepare('SELECT name FROM Driver').get().name, 'Änne');
    assert.equal(db.prepare('SELECT model FROM Car').get().model, plan.cars[0].name);
    assert.equal(fs.readdirSync(path.join(uploads, 'drivers')).length, 1);
    const invalid = {
      drivers: [{ ...plan.drivers[0], name: 'Nicht übernehmen' }],
      cars: [{ name: null, brand: 'Carrera', notes: '' }],
      tracks: [],
    };
    assert.throws(() => insertCockpitData(database, uploads, invalid));
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM Driver').get().n, 1);
    assert.equal(fs.readdirSync(path.join(uploads, 'drivers')).length, 1);
  } finally {
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
