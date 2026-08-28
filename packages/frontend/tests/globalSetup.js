import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Database from 'better-sqlite3'

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backend')
export const E2E_DB = path.join(backendDir, 'prisma', 'e2e.db')

/**
 * Build a throwaway database for the end-to-end run.
 *
 * These tests create and delete real entities, so they must never reach the
 * race database. The schema comes from `prisma migrate diff`, so it can never
 * drift from schema.prisma.
 */
export default function globalSetup() {
  // Already prepared by prepare-e2e-db.js when the backend started
  if (fs.existsSync(E2E_DB) && Date.now() - fs.statSync(E2E_DB).mtimeMs < 60_000) return

  for (const suffix of ['', '-wal', '-shm']) {
    fs.rmSync(E2E_DB + suffix, { force: true })
  }

  const sqlFile = path.join(backendDir, 'prisma', '.e2e-schema.sql')
  execFileSync('npx', ['prisma', 'migrate', 'diff', '--from-empty', '--to-schema', 'prisma/schema.prisma', '--script', '--output', sqlFile], {
    cwd: backendDir,
    stdio: 'pipe',
  })

  const db = new Database(E2E_DB)
  try {
    db.exec(fs.readFileSync(sqlFile, 'utf-8'))
    seed(db)
  } finally {
    db.close()
    fs.rmSync(sqlFile, { force: true })
  }
}

/**
 * Minimal fixture: the championship tests navigate through existing data, so
 * the throwaway database needs a championship with its sessions and drivers.
 */
function seed(db) {
  const now = Date.now()
  const insert = (sql, ...values) => db.prepare(sql).run(...values)

  insert("INSERT INTO Device (id, address, name, type, createdAt, updatedAt) VALUES ('e2e-sim', 'SIMULATOR', 'Simulateur', 'simulator', ?, ?)", now, now)
  insert("INSERT INTO Track (id, name, length, color, createdAt, updatedAt) VALUES ('e2e-track', 'Circuit E2E', 23.03, '#478060', ?, ?)", now, now)

  for (const [id, name, number, color] of [
    ['e2e-d1', 'Pilote Un', 11, '#ef4444'],
    ['e2e-d2', 'Pilote Deux', 22, '#3b82f6'],
  ]) {
    insert("INSERT INTO Driver (id, name, number, color, isReference, createdAt, updatedAt) VALUES (?, ?, ?, ?, 0, ?, ?)", id, name, number, color, now, now)
  }

  for (const [id, brand, model] of [['e2e-c1', 'BMW', 'M4 GT3'], ['e2e-c2', 'AMG', 'GT3']]) {
    insert("INSERT INTO Car (id, brand, model, color, maxSpeed, brakeForce, fuelCapacity, totalRaces, createdAt, updatedAt) VALUES (?, ?, ?, '#6b7280', 100, 50, 100, 0, ?, ?)", id, brand, model, now, now)
  }

  insert("INSERT INTO Championship (id, name, season, status, trackId, mode, createdAt, updatedAt) VALUES ('e2e-champ', 'Championnat E2E', '2026', 'planned', 'e2e-track', 'manual', ?, ?)", now, now)

  for (const [id, name, type, order] of [
    ['e2e-s1', 'Qualifications', 'qualif', 0],
    ['e2e-s2', 'Course', 'race', 1],
  ]) {
    insert("INSERT INTO Session (id, name, type, status, trackId, championshipId, fuelMode, \"order\", createdAt, updatedAt) VALUES (?, ?, ?, 'draft', 'e2e-track', 'e2e-champ', 'OFF', ?, ?, ?)", id, name, type, order, now, now)
    insert("INSERT INTO SessionDriver (id, sessionId, driverId, carId, controller, totalLaps, totalTime, isDNF) VALUES (?, ?, 'e2e-d1', 'e2e-c1', 0, 0, 0, 0)", id + '-a', id)
    insert("INSERT INTO SessionDriver (id, sessionId, driverId, carId, controller, totalLaps, totalTime, isDNF) VALUES (?, ?, 'e2e-d2', 'e2e-c2', 1, 0, 0, 0)", id + '-b', id)
  }
}
