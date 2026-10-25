import { test } from '@jest/globals';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cockpitPlan, cockpitSummary } from '../lib/cockpitPlan.js';
import { insertCockpitData } from '../lib/cockpitData.js';
import { readCockpitArchive } from '../lib/cockpitHistory.js';
import { createBackup, restoreBackup, validateBackup } from '../lib/dataBackup.js';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cockpit-history-')),
    file = path.join(root, 'db.sqlite'),
    uploads = path.join(root, 'uploads');
  const db = new Database(file);
  db.exec(`CREATE TABLE Driver(id TEXT PRIMARY KEY,name TEXT,img TEXT,deletedAt INTEGER,createdAt INTEGER,updatedAt INTEGER);
 CREATE TABLE Car(id TEXT PRIMARY KEY,brand TEXT,model TEXT,notes TEXT,img TEXT,motor TEXT,gearRatio TEXT,maxSpeed INTEGER DEFAULT 100,brakeForce INTEGER DEFAULT 50,fuelCapacity INTEGER DEFAULT 100,tyresRear TEXT,deletedAt INTEGER,createdAt INTEGER,updatedAt INTEGER);
 CREATE TABLE Track(id TEXT PRIMARY KEY,name TEXT,img TEXT,deletedAt INTEGER,createdAt INTEGER,updatedAt INTEGER);
 CREATE TABLE Preference(key TEXT PRIMARY KEY,value TEXT,updatedAt INTEGER);
 CREATE TABLE Session(id TEXT PRIMARY KEY,status TEXT); CREATE TABLE Lap(id TEXT PRIMARY KEY,lapTime INTEGER);
 INSERT INTO Driver(id,name) VALUES('d','Fixture Driver');
 INSERT INTO Car(id,brand,model,notes,maxSpeed,brakeForce,fuelCapacity,tyresRear) VALUES('c','BMW','Modern name','Aus Cockpit-XP übernommen. Ursprüngliche Bezeichnung: BMW alt',77,31,62,'Neue Reifen');
 INSERT INTO Track(id,name) VALUES('t','Fixture Track'); INSERT INTO Session VALUES('s','finished'); INSERT INTO Lap VALUES('lap',5321);`);
  const data = {
    format: 'RaceHubOS-Cockpit-Import',
    version: 2,
    source: 'original.zip',
    drivers: [{ sourceId: '1', name: 'Fixture Driver', aliases: ['Fixture Driver'], active: true }],
    cars: [
      {
        sourceId: '2',
        brand: 'Carrera',
        model: 'Altes Auto',
        aliases: ['BMW alt', 'Altes Auto'],
        active: true,
        technology: { Motor: 'Testmotor', Ritzel: '9', Zahnrad: '27', 'Reifenstatus': 'OK' },
        service: { active: true, values: { Runden: '2000', RundenService: '328' } },
        inUseSince: '01.01.2023',
      },
    ],
    tracks: [{ sourceId: '3', name: 'Fixture Track', aliases: ['Fixture Track'], active: true }],
    history: {
      StRennResults: [
        {
          ID: 1,
          Fahrer: 'Fixture Driver',
          Fahrzeug: 'BMW alt',
          RennStrecke: 'Fixture Track',
          Runden: 5,
          Gesamtzeit: 36000,
          BesteRunde: 7000,
          Platz: 1,
          Datum: '20230101',
          RennArt: 4,
        },
        { ID: 2, Fahrer: null, Platz: null, RennArt: -1 },
      ],
      StMoreRecords: [
        { ID: 3, Driver: 'Fixture Driver', Car: 'BMW alt', Course: 'Fixture Track', Recordtime: 3335, Sector: 1 },
      ],
      StRoundTime: [{ ID: 4, Driver: 'Fixture Driver', Car: '', Course: 'Fixture Track', RoundTime: 7123 }],
      StRennCounter: [{ ID: 5, Typid: 1, Name: 'BMW alt', Totalround: 328, Totaltime: 174, Totaldistance: 4362 }],
      StWinnerItems: [{ ID: 6, TypID: 0, Name: 'Fixture Driver', AnzahlRennen: 10, AnzahlSiege: 3 }],
    },
  };
  return {
    root,
    file,
    db,
    uploads,
    data,
    close() {
      db.close();
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}
test('joint import resolves renamed cars by provenance, preserves setup, separates statistics and is idempotent', () => {
  const f = fixture();
  try {
    const before = f.db.prepare('SELECT * FROM Car').get();
    const plan = cockpitPlan(f.file, f.uploads, f.data);
    assert.equal(plan.cars.length, 0);
    assert.equal(plan.history.records.length, 5);
    assert.equal(plan.history.empty, 1);
    insertCockpitData(f.file, f.uploads, plan);
    const after = f.db.prepare('SELECT * FROM Car').get();
    for (const key of ['maxSpeed', 'brakeForce', 'fuelCapacity', 'tyresRear', 'model', 'notes'])
      assert.equal(after[key], before[key]);
    assert.equal(after.motor, 'Testmotor');
    assert.equal(after.gearRatio, '9 / 27');
    assert.equal(f.db.prepare('SELECT lapTime FROM Lap').get().lapTime, 5321);
    assert.equal(f.db.prepare('SELECT count(*) n FROM Session').get().n, 1);
    const archive = readCockpitArchive(f.db);
    assert.equal(archive.records.length, 5);
    assert.equal(archive.cars[0].service.values.RundenService, '328');
    assert.equal(archive.records.find((r) => r.kind === 'StMoreRecords').raw.Sector, 1);
    f.data.source = 'renamed-backup.zip';
    f.data.history.StRennResults[0] = Object.fromEntries(Object.entries(f.data.history.StRennResults[0]).reverse());
    const repeat = cockpitPlan(f.file, f.uploads, f.data);
    assert.equal(repeat.history.records.length, 0);
    assert.equal(repeat.history.cars.length, 0);
    assert.equal(repeat.history.duplicates, 5);
  } finally {
    f.close();
  }
});
test('ambiguous names, missing referenced cars and invalid numeric values are skipped without guesses', () => {
  const f = fixture();
  try {
    f.db.exec("INSERT INTO Driver(id,name) VALUES('d2','Fixture Driver')");
    let p = cockpitPlan(f.file, f.uploads, f.data);
    assert.equal(p.history.records.filter((r) => r.driverId).length, 0);
    assert.equal(p.drivers.length, 0);
    f.db.exec("DELETE FROM Driver WHERE id='d2'");
    f.data.history.StRennResults[0].Fahrzeug = 'BMW';
    f.data.history.StMoreRecords[0].Recordtime = -1;
    p = cockpitPlan(f.file, f.uploads, f.data);
    assert.equal(p.history.records.length, 3);
    assert.ok(p.history.issues.some((r) => r.reason === 'invalid-value'));
  } finally {
    f.close();
  }
});
test('existing technical fields are preserved and individual import sections can be disabled', () => {
  const f = fixture();
  try {
    f.db.exec("UPDATE Car SET motor='Aktueller Motor',gearRatio='10 / 30'");
    let p = cockpitPlan(f.file, f.uploads, f.data, { history: false, maintenance: false });
    insertCockpitData(f.file, f.uploads, p);
    assert.equal(readCockpitArchive(f.db).records.length, 0);
    assert.equal(readCockpitArchive(f.db).cars[0].service, null);
    assert.equal(f.db.prepare('SELECT motor FROM Car').get().motor, 'Aktueller Motor');
    assert.equal(f.db.prepare('SELECT gearRatio FROM Car').get().gearRatio, '10 / 30');
    p = cockpitPlan(f.file, f.uploads, f.data, { history: false, technology: false });
    insertCockpitData(f.file, f.uploads, p);
    assert.equal(readCockpitArchive(f.db).cars[0].technology.Motor, 'Testmotor');
    assert.equal(readCockpitArchive(f.db).cars[0].service.values.RundenService, '328');
  } finally {
    f.close();
  }
});
test('fresh database imports base entities and their history in one transaction', () => {
  const f = fixture();
  try {
    f.db.exec('DELETE FROM Driver;DELETE FROM Car;DELETE FROM Track');
    const p = cockpitPlan(f.file, f.uploads, f.data);
    assert.equal(p.drivers.length, 1);
    assert.equal(p.cars.length, 1);
    assert.equal(p.tracks.length, 1);
    assert.equal(p.history.records.length, 5);
    insertCockpitData(f.file, f.uploads, p);
    assert.ok(f.db.prepare('SELECT id FROM Car').get().id === readCockpitArchive(f.db).cars[0].carId);
  } finally {
    f.close();
  }
});
test('historical archive participates in native backup and restore without schema changes', () => {
  const f = fixture();
  try {
    insertCockpitData(f.file, f.uploads, cockpitPlan(f.file, f.uploads, f.data));
    const b = createBackup(f.file, f.uploads);
    validateBackup(f.file, b);
    f.db.exec('DELETE FROM Preference');
    restoreBackup(f.file, f.uploads, b);
    assert.equal(readCockpitArchive(f.db).records.length, 5);
  } finally {
    f.close();
  }
});
test('active sessions prohibit writes and transaction failure rolls back both history and technical fields', () => {
  const f = fixture();
  try {
    const p = cockpitPlan(f.file, f.uploads, f.data);
    f.db.exec("UPDATE Session SET status='active'");
    assert.throws(() => insertCockpitData(f.file, f.uploads, p), /Sitzungen/);
    assert.equal(readCockpitArchive(f.db).records.length, 0);
    f.db.exec(
      "UPDATE Session SET status='finished'; CREATE TRIGGER reject_archive BEFORE INSERT ON Preference BEGIN SELECT RAISE(ABORT,'test rollback'); END;"
    );
    assert.throws(() => insertCockpitData(f.file, f.uploads, p), /rollback/);
    assert.equal(f.db.prepare('SELECT motor FROM Car').get().motor, null);
  } finally {
    f.close();
  }
});
test('old v1 packages remain supported and untrusted structures fail before writing', () => {
  const f = fixture();
  try {
    f.data.version = 1;
    delete f.data.history;
    delete f.data.cars[0].technology;
    delete f.data.cars[0].service;
    assert.equal(cockpitSummary(cockpitPlan(f.file, f.uploads, f.data)).counts.history, 0);
    f.data.cars[0].service = { active: true, values: { Runden: { bad: true } } };
    assert.throws(() => cockpitPlan(f.file, f.uploads, f.data), /Wartungsdaten/);
  } finally {
    f.close();
  }
});

test('no-lap sentinel is kept as unknown, and ambiguous legacy track descriptions require exact image evidence', () => {
  const f = fixture();
  try {
    f.data.history.StRennResults[0].BesteRunde = -1;
    f.data.tracks[0].name = 'Originalbahn';
    f.data.tracks[0].aliases = ['Originalbahn', 'Fixture Track'];
    f.data.tracks.push({ sourceId: 'other', name: 'Vorlage', aliases: ['Vorlage', 'Fixture Track'], active: false });
    f.data.history.StRennResults[0].RennStrecke = 'Originalbahn';
    let p = cockpitPlan(f.file, f.uploads, f.data, { tracks: false });
    assert.equal(p.history.records.filter((r) => r.kind === 'StRennResults').length, 0);
    fs.mkdirSync(path.join(f.uploads, 'tracks'), { recursive: true });
    fs.writeFileSync(path.join(f.uploads, 'tracks', 'photo.jpg'), Buffer.from([1, 2, 3]));
    f.db.exec("UPDATE Track SET img='/api/img/tracks/photo.jpg'");
    f.data.tracks[0].image = { extension: '.jpg', data: Buffer.from([1, 2, 3]).toString('base64') };
    p = cockpitPlan(f.file, f.uploads, f.data, { tracks: false });
    assert.equal(p.history.records.find((r) => r.kind === 'StRennResults').raw.BesteRunde, -1);
  } finally {
    f.close();
  }
});

test('identical photos never map two source cars to one current car', () => {
  const f = fixture();
  try {
    fs.mkdirSync(path.join(f.uploads, 'cars'), { recursive: true });
    fs.writeFileSync(path.join(f.uploads, 'cars', 'photo.jpg'), Buffer.from([1, 2, 3]));
    f.db.exec("UPDATE Car SET img='/api/img/cars/photo.jpg'");
    f.data.cars[0].image = { extension: '.jpg', data: Buffer.from([1, 2, 3]).toString('base64') };
    f.data.cars.push({ ...f.data.cars[0], sourceId: 'other', model: 'Different car', aliases: ['Different car'] });
    const p = cockpitPlan(f.file, f.uploads, f.data);
    assert.equal(p.cars.length, 0);
    assert.equal(p.history.cars.length, 0);
    assert.equal(p.history.records.filter((r) => r.carId).length, 0);
  } finally {
    f.close();
  }
});
