import { Server } from 'socket.io'
import { createServer } from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import Database from 'better-sqlite3'

const backend = path.resolve(import.meta.dirname, '../../../backend')
const database = path.join(backend, 'prisma/pit-advice-e2e.db')
const sql = path.join(backend, 'prisma/.pit-advice-e2e.sql')
process.env.DATABASE_URL = 'file:' + database
process.env.PORT = '3227'
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
// Capture only this fixture's server. This control surface never exists in the app.
let sockets
const originalOn = Server.prototype.on
Server.prototype.on = function (event, ...args) {
  if (event === 'connection') sockets = this
  return originalOn.call(this, event, ...args)
}
await import('../../../backend/src/index.js')
Server.prototype.on = originalOn
createServer(async (req, res) => {
  let raw = ''
  for await (const chunk of req) raw += chunk
  try {
    const { event, data } = JSON.parse(raw)
    if (!['race:session', 'session:leaderboard', 'cu:connected', 'cu:disconnected', 'cu:status'].includes(event))
      throw new Error('Unsupported fixture event')
    sockets.emit(event, data)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end('{}')
  } catch {
    res.writeHead(400)
    res.end()
  }
}).listen(3228, '127.0.0.1')
