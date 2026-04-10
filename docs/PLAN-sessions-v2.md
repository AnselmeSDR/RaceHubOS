# Plan: Refonte Système de Sessions (Inspiré SmartRace)

## Objectif
Remplacer le système de phases (practice/qualifying/race dans UNE session) par un modèle SmartRace :
- **Free Practice** : Toujours actif, pas de session
- **Qualifying/Race** : Sessions explicites avec auto-save

## Concepts Clés

### Machine d'État
```
IDLE (Free Practice) → PENDING → RUNNING ↔ PAUSED → RESULTS → IDLE
```

### Modes
| Mode | Session? | Sauvegarde | Gagnant |
|------|----------|------------|---------|
| Free Practice | Non | Tours + Records | N/A |
| Qualifying | Oui | Auto | Meilleur tour |
| Race | Oui | Auto | Plus de tours |

---

## Phase 1: Schéma Base de Données

### Nouveaux Modèles

```prisma
// Configuration controllers (toujours active)
model ControllerConfig {
  id         String   @id @default(cuid())
  controller String   @unique  // "1" à "6"
  driverId   String?
  carId      String?
  trackId    String
  isActive   Boolean  @default(true)
}

// Records de piste (indépendants des sessions)
model TrackRecord {
  id        String   @id @default(cuid())
  trackId   String
  driverId  String
  carId     String
  lapTime   Float
  sessionId String?  // Optionnel
  setAt     DateTime @default(now())

  @@unique([trackId, driverId, carId])
}
```

### Modifications

**Session** :
- Supprimer lien avec `SessionPhase` (plus de phases)
- `type`: "qualifying" | "race" (plus de "practice")
- `status`: "pending" | "running" | "paused" | "finished"

**Lap** :
- Ajouter `trackId` (pour Free Practice sans session)
- `sessionId` devient nullable

**Supprimer** :
- `SessionPhase` (entièrement)

---

## Phase 2: Services Backend

### Fichiers à Créer

1. **`/packages/backend/src/services/LapRecorderService.js`**
   - Valide configuration controller avant enregistrement
   - Émet alerte si controller non configuré
   - Met à jour TrackRecord si nouveau record
   - Émet événements WebSocket

2. **`/packages/backend/src/services/RaceControllerService.js`**
   - Machine d'état (IDLE → PENDING → RUNNING → etc.)
   - Commandes CU (start/pause/stop)
   - Gestion timer (durée/tours max)
   - Calcul résultats

3. **`/packages/backend/src/services/ConfigService.js`**
   - CRUD ControllerConfig
   - Validation configuration complète

4. **`/packages/backend/src/services/LeaderboardService.js`**
   - Calcul positions temps réel
   - Écarts (gap to leader)

### Fichiers à Modifier

- **`trackSync.js`** : Déléguer enregistrement tours à LapRecorderService
- **`controlUnit.js`** : Garder tel quel (couche basse niveau)

### Fichiers à Supprimer

- `SessionManager.js` (remplacé par RaceControllerService)

---

## Phase 3: Routes API

### Nouvelles Routes

**`/api/race`** (Race Control)
```
GET  /status           → État actuel + leaderboard
POST /qualifying       → Créer session qualifying
POST /race             → Créer session race
POST /start            → Démarrer (PENDING → RUNNING)
POST /pause            → Pause
POST /resume           → Reprendre
POST /finish           → Terminer → RESULTS
POST /stop             → Annuler → IDLE
POST /dismiss          → Fermer résultats → IDLE
```

**`/api/config`** (Configuration Controllers)
```
GET  /                 → Config actuelle pour un track
PUT  /:controller      → Mettre à jour un slot
PUT  /bulk             → Mise à jour groupée
```

**`/api/records`** (Track Records)
```
GET  /track/:trackId   → Records du circuit
GET  /driver/:driverId → Records d'un pilote
```

### Routes à Modifier

- `/api/sessions` : Simplifier (CRUD basique, plus de phases)

### Routes à Supprimer

- `/api/session-control` (remplacé par `/api/race`)

---

## Phase 4: Frontend

### Nouvelles Pages

1. **`RaceControl.jsx`** (remplace SessionDetail)
   - Indicateur d'état (IDLE/RUNNING/etc.)
   - Panel configuration controllers
   - Timer (elapsed/remaining)
   - Leaderboard temps réel
   - Boutons contrôle (Start/Pause/Stop/Finish)
   - Modal résultats

2. **`FreePractice.jsx`** (nouvelle)
   - Configuration controllers
   - Feed tours en direct
   - Records du circuit
   - Alerte si controller non configuré

3. **`TrackRecords.jsx`** (nouvelle)
   - Liste records par circuit
   - Filtres par pilote/voiture

### Pages à Modifier

- `SessionsList.jsx` → `SessionHistory.jsx` (historique only)

### Composants Clés

```
src/components/
├── race/
│   ├── Leaderboard.jsx
│   ├── LapTime.jsx
│   ├── CountdownLights.jsx
│   └── GapDisplay.jsx
├── config/
│   ├── ControllerSlot.jsx
│   ├── DriverSelector.jsx
│   └── ConfigStatus.jsx (alerte si incomplet)
└── common/
    ├── CuStatus.jsx
    └── StateChip.jsx
```

### Hooks

```javascript
useRaceState()      // État global machine
useLeaderboard()    // Positions temps réel
useControllerConfig() // Gestion config
```

---

## Phase 5: Migration

### Étape 1: Schéma (non-breaking)
1. Ajouter nouveaux modèles (ControllerConfig, TrackRecord)
2. Ajouter `trackId` à Lap (nullable)
3. Créer migration Prisma

### Étape 2: Données
```javascript
// Peupler trackId sur laps existants
for (lap of laps) {
  lap.trackId = lap.session.trackId
}

// Créer TrackRecords depuis meilleurs tours
for (best of groupBy(laps, [trackId, driverId, carId])) {
  createTrackRecord(best)
}
```

### Étape 3: Services
1. Créer nouveaux services
2. Ajouter nouvelles routes
3. Garder anciennes routes fonctionnelles

### Étape 4: Frontend
1. Créer nouvelles pages
2. Ajouter navigation
3. Feature flag pour switch

### Étape 5: Cleanup
1. Supprimer SessionPhase
2. Supprimer anciennes routes
3. Supprimer SessionManager.js

---

## Fichiers Critiques

### Backend
- `prisma/schema.prisma` - Nouveau schéma
- `src/services/LapRecorderService.js` - NOUVEAU
- `src/services/RaceControllerService.js` - NOUVEAU
- `src/services/ConfigService.js` - NOUVEAU
- `src/routes/race.js` - NOUVEAU
- `src/routes/config.js` - NOUVEAU
- `src/index.js` - Wiring nouveaux services

### Frontend
- `src/pages/RaceControl.jsx` - NOUVEAU
- `src/pages/FreePractice.jsx` - NOUVEAU
- `src/hooks/useRaceState.js` - NOUVEAU
- `src/context/RaceContext.jsx` - NOUVEAU

---

## Estimation Effort

| Phase | Description | Fichiers |
|-------|-------------|----------|
| 1 | Schema + Migration | 2 |
| 2 | Services Backend | 5 |
| 3 | Routes API | 3 |
| 4 | Frontend Pages | 4 |
| 5 | Cleanup | 5 |
| **Total** | | **~19 fichiers** |

---

## Résumé Changements Majeurs

1. **Plus de phases** : Session = Qualifying OU Race (pas les deux)
2. **Free Practice permanent** : Tours enregistrés sans session active
3. **Configuration controllers** : Mapping controller→driver→car persistant
4. **Track Records** : Séparés des sessions
5. **Machine d'état** : Gestion claire des transitions
6. **Alerte config** : Warning si controller non configuré
