# Data Flow Architecture

## Overview

```
CU/Simulator → Event → RAM → Emit → DB
                        ↓
                    Frontend
```

Le principe: **emit === DB**. La data envoyee au front est identique a celle persistee.

## Flow d'un tour

```js
onLapComplete({ controller, lapTime }) {
  // 1. Update RAM
  const state = this.sessionDrivers.find(d => d.controller === controller)
  state.totalLaps++
  state.totalTime += lapTime
  state.bestLapTime = Math.min(state.bestLapTime ?? Infinity, lapTime)
  state.lastLapTime = lapTime

  // 2. Recalculate positions & gaps
  this.recalculatePositions()

  // 3. Save Lap (source de verite)
  await prisma.lap.create({ data: { sessionId, controller, lapTime, ... } })

  // 4. Save SessionDriver (cache, meme structure que RAM)
  await prisma.sessionDriver.update({
    where: { id: state.id },
    data: {
      position: state.position,
      totalLaps: state.totalLaps,
      totalTime: state.totalTime,
      bestLapTime: state.bestLapTime,
      lastLapTime: state.lastLapTime
    }
  })

  // 5. Emit (meme objet)
  io.emit('leaderboard', this.sessionDrivers)
}
```

## Models

### Lap (source de verite)

1 row par tour effectue.

```
id            String
sessionId     String
trackId       String
driverId      String
carId         String
controller    Int        // 0-5

phase         String     // 'free' | 'qualif' | 'race'
lapNumber     Int
lapTime       Float      // ms

sector1       Float?
sector2       Float?
sector3       Float?

softDeletedAt DateTime?
timestamp     DateTime
```

### SessionDriver (cache agrege)

1 row par pilote inscrit a une session. Structure identique a ce qui est emit au front.

```
id              String
sessionId       String
driverId        String
carId           String
controller      Int      // 0-5

gridPos         Int?     // position depart
position        Int?     // position live
finalPos        Int?     // position finale

totalLaps       Int      // COUNT(Lap)
totalTime       Int      // SUM(lapTime) en ms
bestLapTime     Int?     // MIN(lapTime)
lastLapTime     Int?     // dernier tour

lapsAtFinishing Int?     // tours au moment du drapeau
isDNF           Boolean
```

### Driver

```
id          String
name        String
email       String?
photo       String?
color       String      // couleur UI
teamId      String?
number      Int?        // numero de course

// Stats globales
totalRaces  Int
wins        Int
podiums     Int
bestLap     Float?
```

### Car

```
id           String
brand        String
model        String
year         Int?
photo        String?
color        String

// Settings CU
maxSpeed     Int
brakeForce   Int
fuelCapacity Int

// Stats globales
totalRaces   Int
bestLap      Float?
```

## Frontend Strategy

### Chargement initial

```js
// 1. Charger la session (une fois)
const session = await fetch(`/api/sessions/${id}`)
// Contient: drivers[].driver, drivers[].car (metadata complete)

// 2. Charger le leaderboard initial
const leaderboard = await fetch(`/api/sessions/${id}/leaderboard`)
// Contient: stats live uniquement
```

### Updates live

```js
// Socket.io - leaderboard leger (~100 bytes)
socket.on('leaderboard', (data) => {
  setLeaderboard(data)
})

// Affichage: join cote front
leaderboard.map(entry => {
  const sd = session.drivers.find(d => d.id === entry.id)
  return {
    ...entry,
    driverName: sd.driver.name,
    driverColor: sd.driver.color,
    carName: `${sd.car.brand} ${sd.car.model}`
  }
})
```

### Reload

Si le front recharge:
1. `GET /api/sessions/:id` → metadata
2. `GET /api/sessions/:id/leaderboard` → stats (meme format que emit)
3. Socket reconnect → reprend les updates

## SessionDriverState (format unifie)

Structure identique en RAM, DB, et emit:

```ts
type SessionDriverState = {
  // Identifiants
  id: string              // sessionDriverId
  controller: number      // 0-5
  driverId: string
  carId: string

  // Stats live
  position: number
  totalLaps: number
  totalTime: number       // ms
  bestLapTime: number | null
  lastLapTime: number | null
  gap: number | null      // ecart avec P1
}
```

## SQLite Optimization

WAL mode active au demarrage pour performance sur Raspberry Pi / SD card:

```js
await prisma.$executeRaw`PRAGMA journal_mode = WAL`
await prisma.$executeRaw`PRAGMA synchronous = NORMAL`
await prisma.$executeRaw`PRAGMA cache_size = -8000`   // 8MB
await prisma.$executeRaw`PRAGMA temp_store = MEMORY`
```

- `WAL`: writes concurrents, pas de lock readers
- `NORMAL`: fsync au checkpoint seulement
- Perte max en cas de coupure courant: ~1 seconde
