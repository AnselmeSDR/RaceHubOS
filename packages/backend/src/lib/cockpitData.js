import { applyCockpitHistory } from './cockpitHistory.js';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

// Receives only the validated import plan. Never executes Cockpit-XP XML or SQL.
export function insertCockpitData(databasePath, uploads, plan) {
  const written = [],
    db = new Database(databasePath),
    timestamp = Date.now();
  try {
    db.transaction(() => {
      if (
        db.prepare("SELECT name FROM sqlite_master WHERE name='Session'").get() &&
        db.prepare("SELECT 1 FROM Session WHERE status IN ('active','paused','finishing') LIMIT 1").get()
      )
        throw new Error('Bitte zuerst alle laufenden oder pausierten Sitzungen beenden.');
      for (const [group, table] of [
        ['drivers', 'Driver'],
        ['cars', 'Car'],
        ['tracks', 'Track'],
      ])
        for (const item of plan[group]) {
          const id = item.id || randomUUID();
          let img = null;
          if (item.image) {
            const name = `cockpit-${id}${item.image.extension}`,
              target = path.join(uploads, group, name);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, Buffer.from(item.image.data, 'base64'));
            written.push(target);
            img = `/api/img/${group}/${name}`;
          }
          if (group === 'cars')
            db.prepare('INSERT INTO Car (id,brand,model,notes,img,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)').run(
              id,
              item.brand,
              item.name,
              item.notes,
              img,
              timestamp,
              timestamp
            );
          else
            db.prepare(`INSERT INTO ${table} (id,name,img,createdAt,updatedAt) VALUES (?,?,?,?,?)`).run(
              id,
              item.name,
              img,
              timestamp,
              timestamp
            );
        }
      if (plan.history) applyCockpitHistory(db, plan.history, plan.source);
    })();
  } catch (error) {
    for (const file of written) fs.rmSync(file, { force: true });
    throw error;
  } finally {
    db.close();
  }
}
