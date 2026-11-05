import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import Database from 'better-sqlite3'

const backend = path.resolve(import.meta.dirname, '../../../backend')
const database = path.join(backend, 'prisma/race-screen-e2e.db')
const sql = path.join(backend, 'prisma/.race-screen-e2e.sql')
process.env.DATABASE_URL = 'file:' + database
process.env.PORT = '3221'
process.env.USE_MOCK_DEVICE = 'true'
for (const suffix of ['', '-wal', '-shm']) fs.rmSync(database + suffix, { force: true })
execFileSync(
  process.execPath,
  [
    path.resolve(backend, '../../node_modules/prisma/build/index.js'),
    'migrate',
    'diff',
    '--from-empty',
    '--to-schema',
    'prisma/schema.prisma',
    '--script',
    '--output',
    sql,
  ],
  { cwd: backend, stdio: 'pipe' }
)
const db = new Database(database)
db.exec(fs.readFileSync(sql, 'utf8'))
db.close()
fs.rmSync(sql)
process.env.NODE_ENV = 'test'
await import('../../../backend/src/index.js')
