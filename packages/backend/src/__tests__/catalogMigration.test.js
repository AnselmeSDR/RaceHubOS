import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

test('catalog migration preserves existing car equipment and CU settings and starts empty', () => {
  const db = new Database(':memory:');
  try {
    const migrations = path.resolve(import.meta.dirname, '../../prisma/migrations');
    const names = fs
      .readdirSync(migrations)
      .filter((name) => fs.existsSync(path.join(migrations, name, 'migration.sql')))
      .sort();
    for (const name of names.filter((name) => !name.endsWith('_local_catalog'))) {
      db.exec(fs.readFileSync(path.join(migrations, name, 'migration.sql'), 'utf8'));
    }
    db.prepare(
      'INSERT INTO Car (id, brand, model, tyresFront, maxSpeed, totalRaces, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, 0, 0)'
    ).run('old', 'Own', 'Car', 'Mounted', 30, 8);
    const migration = names.find((name) => name.endsWith('_local_catalog'));
    db.exec(fs.readFileSync(path.join(migrations, migration, 'migration.sql'), 'utf8'));
    expect(db.prepare('SELECT serial, tyresFront, maxSpeed, totalRaces FROM Car WHERE id = ?').get('old')).toEqual({
      serial: null,
      tyresFront: 'Mounted',
      maxSpeed: 30,
      totalRaces: 8,
    });
    expect(db.prepare('SELECT COUNT(*) AS count FROM CatalogEntry').get().count).toBe(0);
  } finally {
    db.close();
  }
});
