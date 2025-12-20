# Tâches - Refonte Sessions v2

## Phase 1: Base de Données (2 tâches)

### TASK-01: Schema Prisma
**Agent**: Backend
**Fichiers**: `packages/backend/prisma/schema.prisma`
**Action**:
- Ajouter model `ControllerConfig`
- Ajouter model `TrackRecord`
- Modifier `Lap`: ajouter `trackId`, rendre `sessionId` nullable
- Modifier `Session`: simplifier (supprimer lien SessionPhase)
- Garder `SessionPhase` pour migration (supprimer plus tard)

### TASK-02: Migration Données
**Agent**: Backend
**Fichiers**: Script de migration
**Dépend de**: TASK-01
**Action**:
- Script pour peupler `trackId` sur Laps existants
- Script pour créer TrackRecords depuis meilleurs tours
- Prisma migrate

---

## Phase 2: Services Backend (4 tâches)

### TASK-03: ConfigService
**Agent**: Backend
**Fichiers**: `packages/backend/src/services/ConfigService.js`
**Action**:
- CRUD ControllerConfig
- `getConfig(controller, trackId)` → driver/car mapping
- `isConfigured(controller)` → boolean
- `getAllConfigs(trackId)` → liste configs
- Validation configuration complète

### TASK-04: LapRecorderService
**Agent**: Backend
**Fichiers**: `packages/backend/src/services/LapRecorderService.js`
**Dépend de**: TASK-03
**Action**:
- `recordLap(controller, lapTime, trackId, sessionId?)`
- Valide config avant enregistrement
- Émet alerte WebSocket si non configuré
- Met à jour TrackRecord si nouveau record
- EventEmitter pour `lap:recorded`, `lap:unconfigured`, `record:new`

### TASK-05: LeaderboardService
**Agent**: Backend
**Fichiers**: `packages/backend/src/services/LeaderboardService.js`
**Action**:
- `getLeaderboard(sessionId?)` → positions temps réel
- `calculatePositions(laps)` → classement
- `getGaps(leaderboard)` → écarts
- Support Free Practice (par trackId) et Session

### TASK-06: RaceControllerService
**Agent**: Backend
**Fichiers**: `packages/backend/src/services/RaceControllerService.js`
**Dépend de**: TASK-04, TASK-05
**Action**:
- Machine d'état: IDLE → PENDING → RUNNING → PAUSED → RESULTS
- `getState()` → état actuel
- `startQualifying(params)` → PENDING
- `startRace(params)` → PENDING
- `start()` → RUNNING (+ CU countdown)
- `pause()` → PAUSED
- `resume()` → RUNNING
- `finish()` → RESULTS
- `stop()` → IDLE (annule)
- `dismiss()` → IDLE (après résultats)
- Timer automatique (durée/tours max)
- Calcul résultats fin de session

---

## Phase 3: Routes API (4 tâches)

### TASK-07: Routes /api/config
**Agent**: Backend
**Fichiers**: `packages/backend/src/routes/config.js`
**Dépend de**: TASK-03
**Action**:
```
GET  /                 → getAllConfigs(trackId)
GET  /:controller      → getConfig(controller, trackId)
PUT  /:controller      → updateConfig
PUT  /bulk             → updateMultiple
DELETE /               → clearAll(trackId)
```

### TASK-08: Routes /api/race
**Agent**: Backend
**Fichiers**: `packages/backend/src/routes/race.js`
**Dépend de**: TASK-06
**Action**:
```
GET  /status           → getState() + leaderboard
POST /qualifying       → startQualifying
POST /race             → startRace
POST /start            → start
POST /pause            → pause
POST /resume           → resume
POST /finish           → finish
POST /stop             → stop
POST /dismiss          → dismiss
```

### TASK-09: Routes /api/records
**Agent**: Backend
**Fichiers**: `packages/backend/src/routes/records.js`
**Action**:
```
GET  /track/:trackId   → records du circuit
GET  /driver/:driverId → records d'un pilote
GET  /car/:carId       → records d'une voiture
```

### TASK-10: Simplifier /api/sessions
**Agent**: Backend
**Fichiers**: `packages/backend/src/routes/sessions-simple.js`
**Action**:
- Garder uniquement CRUD basique
- Supprimer logique de phases
- Ajouter option `keepLaps` sur DELETE

---

## Phase 4: Frontend - Hooks & Context (3 tâches)

### TASK-11: RaceContext
**Agent**: Frontend
**Fichiers**: `packages/frontend/src/context/RaceContext.jsx`
**Action**:
- Provider global état course
- Socket.IO connection
- État: `state`, `session`, `leaderboard`, `config`, `cuConnected`
- Actions: `startQualifying`, `startRace`, `pause`, `resume`, `finish`, `stop`

### TASK-12: useRaceState Hook
**Agent**: Frontend
**Fichiers**: `packages/frontend/src/hooks/useRaceState.js`
**Dépend de**: TASK-11
**Action**:
- Consomme RaceContext
- Helpers: `isIdle`, `isRunning`, `isPaused`, etc.
- `elapsed`, `remaining` calculés
- `canStart`, `canPause`, `canFinish` états

### TASK-13: useControllerConfig Hook
**Agent**: Frontend
**Fichiers**: `packages/frontend/src/hooks/useControllerConfig.js`
**Action**:
- Fetch/update configuration controllers
- `configs[]` - liste des 6 slots
- `updateSlot(controller, driverId, carId)`
- `isComplete` - tous les slots configurés?
- `unconfiguredSlots` - liste slots vides

---

## Phase 5: Frontend - Composants (4 tâches)

### TASK-14: Composants Config
**Agent**: Frontend
**Fichiers**:
- `packages/frontend/src/components/config/ControllerSlot.jsx`
- `packages/frontend/src/components/config/ConfigPanel.jsx`
- `packages/frontend/src/components/config/ConfigStatus.jsx`
**Action**:
- ControllerSlot: Un slot avec selects driver/car
- ConfigPanel: Les 6 slots
- ConfigStatus: Alerte si config incomplète

### TASK-15: Composants Race
**Agent**: Frontend
**Fichiers**:
- `packages/frontend/src/components/race/Leaderboard.jsx`
- `packages/frontend/src/components/race/LapTime.jsx`
- `packages/frontend/src/components/race/GapDisplay.jsx`
- `packages/frontend/src/components/race/StateChip.jsx`
**Action**:
- Leaderboard: Tableau positions temps réel
- LapTime: Affichage formaté temps
- GapDisplay: Écart au leader
- StateChip: Badge état (IDLE/RUNNING/etc)

### TASK-16: Page FreePractice
**Agent**: Frontend
**Fichiers**: `packages/frontend/src/pages/FreePractice.jsx`
**Dépend de**: TASK-14, TASK-15
**Action**:
- ConfigPanel en haut
- Feed tours en direct (scroll)
- Track Records sidebar
- Alerte si controller non configuré
- Boutons Start Qualifying / Start Race

### TASK-17: Page RaceControl
**Agent**: Frontend
**Fichiers**: `packages/frontend/src/pages/RaceControl.jsx`
**Dépend de**: TASK-14, TASK-15
**Action**:
- Header: État, Timer, CU Status
- Leaderboard principal
- Contrôles: Start/Pause/Resume/Finish/Stop
- Modal résultats fin de session
- Retour Free Practice après dismiss

---

## Phase 6: Wiring & Cleanup (3 tâches)

### TASK-18: Wiring Backend
**Agent**: Backend
**Fichiers**: `packages/backend/src/index.js`
**Dépend de**: TASK-04, TASK-06, TASK-07, TASK-08, TASK-09
**Action**:
- Instancier nouveaux services
- Connecter LapRecorder à TrackSync
- Monter nouvelles routes
- Garder anciennes routes (compatibilité)

### TASK-19: Navigation Frontend
**Agent**: Frontend
**Fichiers**:
- `packages/frontend/src/App.jsx`
- `packages/frontend/src/components/Layout.jsx`
**Dépend de**: TASK-16, TASK-17
**Action**:
- Route `/practice` → FreePractice
- Route `/race` → RaceControl
- Route `/history` → SessionsList (renommer)
- Menu: Practice | Race | History | ...

### TASK-20: Cleanup
**Agent**: Backend + Frontend
**Dépend de**: Toutes les autres
**Action**:
- Supprimer `SessionManager.js`
- Supprimer `SessionPhase` du schema
- Supprimer `/api/session-control`
- Supprimer `SessionDetail.jsx` (remplacé par RaceControl)
- Supprimer `PhaseControl.jsx`

---

## Ordre d'Exécution Suggéré

```
Parallèle 1 (Base):
  TASK-01 (Schema)
  TASK-03 (ConfigService)
  TASK-05 (LeaderboardService)
  TASK-09 (Routes records)

Parallèle 2 (Après Schema):
  TASK-02 (Migration) ← TASK-01
  TASK-04 (LapRecorder) ← TASK-03

Parallèle 3 (Services):
  TASK-06 (RaceController) ← TASK-04, TASK-05
  TASK-07 (Routes config) ← TASK-03
  TASK-10 (Sessions simple)

Parallèle 4 (Routes + Frontend base):
  TASK-08 (Routes race) ← TASK-06
  TASK-11 (RaceContext)
  TASK-13 (useControllerConfig)

Parallèle 5 (Frontend):
  TASK-12 (useRaceState) ← TASK-11
  TASK-14 (Composants Config)
  TASK-15 (Composants Race)

Parallèle 6 (Pages):
  TASK-16 (FreePractice) ← TASK-14, TASK-15
  TASK-17 (RaceControl) ← TASK-14, TASK-15

Parallèle 7 (Wiring):
  TASK-18 (Wiring Backend)
  TASK-19 (Navigation Frontend)

Séquentiel Final:
  TASK-20 (Cleanup) ← Tout
```

---

## Résumé

| Phase | Tâches | Description |
|-------|--------|-------------|
| 1 | 01-02 | Database |
| 2 | 03-06 | Services Backend |
| 3 | 07-10 | Routes API |
| 4 | 11-13 | Hooks Frontend |
| 5 | 14-17 | Composants & Pages |
| 6 | 18-20 | Wiring & Cleanup |

**Total: 20 tâches**
