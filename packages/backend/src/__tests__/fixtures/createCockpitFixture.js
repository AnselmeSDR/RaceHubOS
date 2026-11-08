import Database from 'better-sqlite3';
import JSZip from 'jszip';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/** Synthetic data and a generated 1x1 PNG; no user backup or third-party photo. */
export async function createCockpitFixture({ ambiguous = false, carPhoto = false } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cockpit-fixture-'));
  try {
    const master = new Database(path.join(root, 'master'));
    master.exec(`CREATE TABLE DriverItems(ID INTEGER,Driver TEXT,FullName TEXT,Activ INTEGER,Picture TEXT);
    INSERT INTO DriverItems VALUES(1,'Fixture Driver','Fixture Driver',1,'driver.png');
    INSERT INTO DriverItems VALUES(2,'Unused Driver','Unused Driver',0,NULL);
    CREATE TABLE CarItems(ID INTEGER,Car TEXT,FullName TEXT,Activ INTEGER,Picture TEXT);
    INSERT INTO CarItems VALUES(3,'Fixture Car','Fixture Car',1,${carPhoto ? "'driver.png'" : 'NULL'});
    CREATE TABLE CourseItems(ID INTEGER,Course TEXT,FullName TEXT,Activ INTEGER,Picture TEXT);
    INSERT INTO CourseItems VALUES(4,'Fixture Track','Fixture Track',1,NULL);
    CREATE TABLE CarData(CarName TEXT,Property TEXT,Value TEXT);
    INSERT INTO CarData VALUES('Fixture Car','Motor','Fixture motor');`);
    master.close();
    const history = new Database(path.join(root, 'history'));
    history.exec(`CREATE TABLE StRennResults(ID INTEGER,Fahrer TEXT,Fahrzeug TEXT,RennStrecke TEXT,Runden INTEGER,Gesamtzeit INTEGER,BesteRunde INTEGER,Platz INTEGER,Datum TEXT,MasterID TEXT);
    INSERT INTO StRennResults VALUES(1,'Fixture Driver','Fixture Car','Fixture Track',5,36000,7000,1,'20230101','race-1');
    CREATE TABLE StRoundTime(ID INTEGER,Driver TEXT,Car TEXT,Course TEXT,RoundTime INTEGER,Date TEXT,MasterID TEXT);
    INSERT INTO StRoundTime VALUES(3,'Fixture Driver','Fixture Car','Fixture Track',7123,'20230101',${ambiguous ? 'NULL' : "'race-1'"});`);
    if (ambiguous)
      history.exec(
        "INSERT INTO StRennResults VALUES(2,'Fixture Driver','Fixture Car','Fixture Track',3,22000,7000,1,'20230101','race-2')"
      );
    history.close();
    const zip = new JSZip();
    zip.file('Database.sqlite/cpv2stamm', await fs.readFile(path.join(root, 'master')));
    zip.file('Database.sqlite/cpv2statistik', await fs.readFile(path.join(root, 'history')));
    zip.file(
      'Bilder/driver.png',
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
        'base64'
      )
    );
    zip.file('AddOns/never-run.js', 'throw new Error("Do not execute")');
    zip.file('../never-extract.txt', 'Do not extract');
    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}
