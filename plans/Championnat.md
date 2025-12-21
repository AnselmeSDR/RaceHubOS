# Championnat

## Organisation d'un Championnat

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CHAMPIONNAT                                    │
│  - Nom, Saison                                                          │
│  - Circuit (trackId) - fixe pour tout le championnat                    │
│  - Classement Général (standings)                                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐         ┌───────────────┐         ┌───────────────┐
│  ESSAIS LIBRES │         │ QUALIFICATIONS │         │    COURSES    │
│   (practice)   │         │  (qualifying)  │         │    (race)     │
│                │         │                │         │               │
│ - Session      │         │ Q1, Q2, Q3...  │         │ R1, R2, R3... │
│   permanente   │         │                │         │               │
│ - Pas de limite│         │ - X min ou     │         │ - X tours ou  │
│ - Reset manuel │         │ - X tours      │         │ - X min       │
└───────────────┘         └───────────────┘         └───────────────┘
        │                           │                           │
        │                           │                           │
        ▼                           ▼                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           SESSION                                        │
│  - id, name, type, status                                               │
│  - duration (minutes) OU maxLaps (tours)                                │
│  - trackId, championshipId                                              │
│  - startedAt, finishedAt                                                │
└─────────────────────────────────────────────────────────────────────────┘
        │
        ├──────────────────────────────────────────┐
        │                                          │
        ▼                                          ▼
┌───────────────────────┐              ┌───────────────────────┐
│   SESSION DRIVERS     │              │        LAPS           │
│                       │              │                       │
│ - controller (1-6)    │              │ - lapNumber           │
│ - driverId            │              │ - lapTime (ms)        │
│ - carId               │              │ - controller          │
│ - gridPos             │              │ - driverId            │
│ - position (live)     │              │ - phase (free/qualif/ │
│ - finalPos            │              │          race)        │
└───────────────────────┘              │ - timestamp           │
                                       └───────────────────────┘
                                                │
                                                ▼
                                    ┌───────────────────────┐
                                    │     LEADERBOARD       │
                                    │   (temps réel)        │
                                    │                       │
                                    │ - Position            │
                                    │ - Tours               │
                                    │ - Meilleur temps      │
                                    │ - Dernier temps       │
                                    │ - Écart (gap)         │
                                    └───────────────────────┘
```

## Architecture UI

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      SECTION CHAMPIONNAT                                │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ Nom Championnat | Circuit                           ⚙️ [config]   │  │
│  │                                                                   │  │
│  │ Sessions: [EL] [Q1] [Q2] [R1] [R2]  [+ Qualif] [+ Course]        │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       SECTION SESSION                                   │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ Titre: Q1 - Qualifications                          ⚙️ [config]   │  │
│  │ Condition: 5:00 ████████░░ (animation si active)                  │  │
│  │                                                                   │  │
│  │ Config Controllers (si draft/ready):                             │  │
│  │ ┌─────┬──────────┬──────────┐                                    │  │
│  │ │ Ctrl│ Pilote   │ Voiture  │  (vierge tant que non configuré)   │  │
│  │ │  1  │ [---]    │ [---]    │                                    │  │
│  │ │  2  │ [---]    │ [---]    │                                    │  │
│  │ └─────┴──────────┴──────────┘                                    │  │
│  │                                                                   │  │
│  │ [Démarrer] / [Arrêter] / [Terminer]  (selon status)              │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         LEADERBOARD                                     │
│  (unifié pour EL/Q/R - colonnes identiques)                            │
│  ┌─────┬────────┬───────┬──────────┬──────────┬────────┐               │
│  │ Pos │ Pilote │ Tours │ Meilleur │ Dernier  │ Écart  │               │
│  ├─────┼────────┼───────┼──────────┼──────────┼────────┤               │
│  │  1  │ A      │  12   │  5.234   │  5.300   │  ---   │               │
│  │  2  │ B      │  11   │  5.456   │  5.500   │ +0.222 │               │
│  └─────┴────────┴───────┴──────────┴──────────┴────────┘               │
│                                                                         │
│  EL: [Tri: Tours ▼ | Temps]  [Réinitialiser]                           │
│  Q:  (trié par meilleur temps - pas d'options)                         │
│  R:  (trié par tours puis temps total - pas d'options)                 │
└─────────────────────────────────────────────────────────────────────────┘
```

### Responsabilités

| Élément | Section Session | Leaderboard |
|---------|-----------------|-------------|
| Titre session (Q1, R1...) | ✅ | ❌ |
| Type (Qualif/Course) | ✅ | ❌ |
| Condition (temps/tours) | ✅ avec animation | ❌ |
| Config controllers | ✅ (vierge par défaut) | ❌ |
| Boutons status | ✅ Démarrer/Arrêter | ❌ |
| Bouton config ⚙️ | ✅ | ❌ |
| Colonnes données | ❌ | ✅ Tours/Meilleur/Dernier/Écart |
| Tri EL | ❌ | ✅ Tours ou Temps |
| Reset EL | ❌ | ✅ (garde best pour standings) |

### Tri par type de session

| Type | Tri | Modifiable | `sortBy` prop |
|------|-----|------------|---------------|
| `practice` (EL) | Tours OU Temps | ✅ Toggle | `laps` ou `bestLap` |
| `qualifying` (Q) | Meilleur temps | ❌ Fixe | `bestLap` |
| `race` (R) | Tours puis temps total | ❌ Fixe | `race` |

```jsx
<Leaderboard
  entries={[...]}
  sortBy="laps" | "bestLap" | "race"
  onSortChange={fn}     // uniquement pour EL (toggle UI)
/>
```

**Logique de tri:**
- `laps`: nombre de tours décroissant, puis meilleur temps
- `bestLap`: meilleur temps croissant
- `race`: tours décroissant, puis temps total croissant

### Comportement EL - Réinitialiser

Le bouton "Réinitialiser" est dans la **Section Session**, pas le Leaderboard.

**Soft Delete:**
```
Lap {
  ...
  softDeletedAt: DateTime?  // null = actif, date = supprimé
}
```

| Vue | Filtre |
|-----|--------|
| Leaderboard EL | `WHERE softDeletedAt IS NULL` |
| Classement général EL | Tous les laps (inclut soft deleted) |

---

**Flow:**

```
User clique "Réinitialiser"
         │
         ▼
┌─────────────────────────┐
│  POST /api/sessions     │
│  /:id/reset-practice    │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│  Backend:                               │
│  1. UPDATE laps SET softDeletedAt=NOW() │
│     WHERE sessionId = :id               │
│       AND softDeletedAt IS NULL         │
│  2. Émet WebSocket "practice_reset"     │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│  Frontend:                              │
│  - Leaderboard = vide                   │
│  - Classement général EL = inchangé     │
└─────────────────────────────────────────┘
```

**Calculs:**
```sql
-- Leaderboard EL (session courante)
SELECT * FROM laps
WHERE sessionId = :id AND softDeletedAt IS NULL

-- Classement général EL (tous temps confondus)
SELECT driverId, MIN(lapTime) as bestLap
FROM laps
WHERE sessionId = :practiceSessionId
-- Pas de filtre softDeletedAt = inclut les soft deleted
GROUP BY driverId
ORDER BY bestLap ASC
```

---

## Flux de données

```
                    ┌─────────────────┐
                    │   CU / Simu     │
                    │  (lap events)   │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   WebSocket     │
                    │  lap_completed  │
                    └────────┬────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
            ▼                ▼                ▼
    ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
    │ Practice      │ │ Qualifying    │ │ Race          │
    │ (EL)          │ │ (Q)           │ │ (R)           │
    └───────┬───────┘ └───────┬───────┘ └───────┬───────┘
            │                 │                 │
            └────────────────┬┴─────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  LEADERBOARD    │
                    │   UNIFIÉ        │
                    │                 │
                    │ Colonnes:       │
                    │ - Position      │
                    │ - Pilote        │
                    │ - Tours         │
                    │ - Meilleur      │
                    │ - Dernier       │
                    │ - Écart         │
                    └─────────────────┘
```

---

## Analyse des Composants Leaderboard Actuels

### 1. Leaderboard.jsx (Q/R)

**Source de données:** Array `leaderboard` pré-formatée

**Entrée attendue:**
```js
{
  position: number,
  positionDelta: number,
  driver: { id, name, color, photo, number },
  car: { brand, model },
  laps: number,
  bestLap: number (ms),
  lastLap: number (ms),
  gap: string ("+2.5s" ou "+1 LAP"),
  hasFastestLap: boolean
}
```

**Fonctionnalités:**
- [x] Position avec podium colors (or/argent/bronze)
- [x] Position delta (flèches up/down)
- [x] Photo pilote avec fallback initiale
- [x] Numéro pilote NASCAR style
- [x] Nom/Voiture
- [x] Stats: Tours, Meilleur, Dernier
- [x] Gap display
- [x] Animation Framer Motion
- [ ] ~~Tri par Tours/Temps~~ (données pré-triées)
- [ ] ~~Bouton reset~~

**Utilisé dans:** RaceControl, RacePage, ChampionshipDetail (Q/R)

---

### 2. FreePracticeLeaderboard.jsx (Practice)

**Source de données:** Object `freePracticeBoard` + Array `configs`

**Entrée attendue:**
```js
// freePracticeBoard
{
  "1": { laps: 5, bestLap: 5234, lastLap: 5300 },
  "2": { laps: 3, bestLap: 5456, lastLap: 5500 },
  ...
}

// configs
[
  { controller: "1", driver: {...}, car: {...} },
  ...
]
```

**Fonctionnalités:**
- [x] Merge interne des données (board + configs)
- [x] Tri par Tours OU Temps (toggle)
- [x] Bouton Réinitialiser
- [x] Même style NASCAR que Leaderboard
- [x] Animation Framer Motion
- [ ] ~~Gap display~~
- [ ] ~~Position delta~~

**Utilisé dans:** RacePage, ChampionshipDetail (Practice)

---

### 3. FreePracticeEntry.jsx

**Rôle:** Rendu d'une entrée du leaderboard practice

**Quasi-identique à:** Le rendu inline dans Leaderboard.jsx

---

## Conflits et Problèmes Identifiés

| Problème | Description |
|----------|-------------|
| **Formats différents** | Leaderboard attend un array, FreePractice un object + configs |
| **Duplication code** | FreePracticeEntry ≈ 95% identique au rendu Leaderboard |
| **Fonctionnalités manquantes** | Practice n'a pas gap, Q/R n'a pas sort |
| **Sources multiples** | Practice = RaceContext, Q/R = SessionData |
| **Tri incohérent** | Practice permet tri, Q/R non |

---

## Proposition: Composant Unifié

### SessionLeaderboard

```jsx
<SessionLeaderboard
  entries={[...]}           // Format unifié
  sessionType="practice|qualifying|race"

  // Options conditionnelles
  sortBy="laps|time"        // Uniquement practice
  onSortChange={fn}
  showGap={true}            // Uniquement Q/R
  onReset={fn}              // Uniquement practice
/>
```

### Format d'entrée unifié

```js
{
  id: string,
  controller: string,
  position: number,
  positionDelta?: number,

  driver: {
    id: string,
    name: string,
    color: string,
    photo?: string,
    number?: string
  },

  car?: {
    brand: string,
    model: string
  },

  stats: {
    laps: number,
    bestLap: number,      // ms
    lastLap: number,      // ms
    totalTime?: number,   // ms (pour course)
    gap?: string          // "+2.5s" ou "+1 LAP"
  },

  flags: {
    hasFastestLap?: boolean,
    isDNF?: boolean,
    isFinished?: boolean
  }
}
```

### LeaderboardEntry (composant unique)

- Remplace FreePracticeEntry
- Remplace le rendu inline de Leaderboard
- Props: `entry`, `position`, `showGap`

---

## TODO Refactoring

1. [ ] Créer `LeaderboardEntry.jsx` - composant de rendu unique
2. [ ] Créer `SessionLeaderboard.jsx` - wrapper avec options
3. [ ] Adapter les sources de données pour produire le format unifié
4. [ ] Migrer ChampionshipDetail vers le nouveau composant
5. [ ] Migrer RacePage vers le nouveau composant
6. [ ] Supprimer FreePracticeLeaderboard et FreePracticeEntry
7. [ ] Tester tous les modes (practice, qualif, race)

---

1. [ ] pouvoir configurer pour chaque qualif/course le controller/pilote/voiture
2. [ ] tous les pilotes ne roulent pas à chaque qualif/course, on peut avoir 10 pilotes et seulement 4 roulent à une
   qualif/course
   2.1. il faut pouvoir gérer ça dans l'UI (sélection pilote/voiture par controller)
   2.2. les pilotes non présents n'apparaissent pas dans le classement de la qualif/course
   2.3. dans le classement général, les pilotes non présents ne sont pas impactés, cela va permettre de creer des
   divisions (ex: division 1 avec pilotes A,B,C,D et division 2 avec pilotes E,F,G,H)


- Classement qualifications
    - le classement se fait en fonction du meilleur temps au tour de toutes les qualifications de chaque pilote
- Classement courses
    - le classement se fait en fonction du nombre de tours total terminés puis du temps total de toutes les courses de
      chaque pilote

- Classement qualifications (variant)
    - Cumul des meilleurs temps au tour de chaque qualification de chaque pilote

- Classement général
    - on a un onglet qualifications et un onglet courses
    - pour chaque onglet, on affiche le classement général correspondant.

# Qualifications

- pour une qualif de X minutes:
    - le pilote peut rouler autant de tours qu'il veut pendant les X minutes
    - le classement se fait en fonction du meilleur temps au tour
    - une fois les X minutes passées, la session se termine pour tout le monde et on coupe le CU (bouton start + led 1)
- pour une qualif de X tours:
    - la qualif se termine quand le premier a fait X tours
    - les autres peuvent continuer à rouler pour terminer leur X tours
    - le classement se fait en fonction du meilleur temps au tour
    - une fois tout le monde a terminé ses X tours, la session se termine pour tout le monde et on coupe le CU (bouton
      start + led 1)

# Courses

- pour une course de X tours:
    - la course se termine quand le premier a fait X tours
    - les autres peuvent continuer à rouler pour terminer leur tour actuel
    - le classement se fait en fonction du nombre de tours terminés puis du temps total
    - DNF s'il n'a pas terminé sont tour actuel au bout de 30s après le premier
    - une fois les 30s passées, la session se termine pour tout le monde et on coupe le CU (bouton start + led 1)
- pour une course de durée X minutes:
    - la course se termine quand le temps est écoulé et que tout le monde a terminé son tour actuel
    - le classement se fait en fonction du nombre de tours terminés puis du temps total
    - DNF s'il n'a pas terminé sont tour actuel au bout de 30s après la fin du temps
    - une fois les 30s passées, la session se termine pour tout le monde et on coupe le CU (bouton start + led 1)

---

## Configuration

### Types de Session

| Type | Code | Description | Condition d'arrêt |
|------|------|-------------|-------------------|
| Essais Libres | `practice` | Session permanente, pas de limite | Manuel (reset) |
| Qualifications | `qualifying` | Session chronométrée | Temps OU Tours |
| Course | `race` | Session compétitive | Temps OU Tours |

### Configuration Session

```js
{
  // Identité
  id: string,              // cuid auto-généré
  name: string,            // "Q1", "Course 1", etc.
  type: "practice" | "qualifying" | "race",

  // Condition d'arrêt (mutuellement exclusif)
  duration: number | null, // minutes (ex: 5, 10, 15)
  maxLaps: number | null,  // tours (ex: 10, 20, 50)

  // Références
  trackId: string,         // circuit (hérité du championnat)
  championshipId: string,  // championnat parent

  // Timestamps
  startedAt: DateTime | null,
  finishedAt: DateTime | null,
  createdAt: DateTime,
  updatedAt: DateTime,
}
```

### Configuration Controller (SessionDriver)

```js
{
  id: string,
  sessionId: string,
  controller: "1" | "2" | "3" | "4" | "5" | "6",

  // Assignation
  driverId: string,        // pilote assigné
  carId: string | null,    // voiture assignée (optionnel)

  // Positions
  gridPos: number | null,  // position grille départ (1-6)
  position: number | null, // position en temps réel
  finalPos: number | null, // position finale
}
```

---

## Statuts

### Championship Status

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│ planned  │ ──► │  active  │ ──► │ finished │
└──────────┘     └──────────┘     └──────────┘
     │                                  ▲
     └──────────────────────────────────┘
                 (skip if no sessions)
```

| Status | Description |
|--------|-------------|
| `planned` | Championnat créé, pas encore commencé |
| `active` | Au moins une session en cours ou terminée |
| `finished` | Toutes les sessions terminées |

### Session Status

```
┌───────┐     ┌───────┐     ┌────────┐     ┌───────────┐     ┌──────────┐
│ draft │ ◄─► │ ready │ ──► │ active │ ──► │ finishing │ ──► │ finished │
└───────┘     └───────┘     └────────┘     └───────────┘     └──────────┘
                                                 │
                                          (30s grace period)
```

| Status | Description | Config modifiable |
|--------|-------------|-------------------|
| `draft` | Config pilotes/voitures en cours | ✅ Oui |
| `ready` | Config validée, prêt à démarrer | ❌ Non (retour draft possible) |
| `active` | Session en cours, laps enregistrés | ❌ Non |
| `finishing` | Condition atteinte, grace period 30s | ❌ Non |
| `finished` | Résultats finaux, immutable | ❌ Non |

### Transitions de Status

| De | Vers | Trigger |
|----|------|---------|
| `draft` → `ready` | Bouton "Valider" dans popup config |
| `ready` → `draft` | Bouton "Modifier" dans popup config |
| `ready` → `active` | Bouton "Démarrer" + CU activé |
| `active` → `finishing` | Condition atteinte (temps/tours) |
| `finishing` → `finished` | Grace period (30s) écoulée |
| `active` → `finished` | Bouton "Terminer" (force stop) |

### UI Session Config

```
┌─────────────────────────────────────────────────────┐
│  Session: Q1                              ⚙️ [gear] │
└─────────────────────────────────────────────────────┘
                        │
                        ▼ (click gear)
┌─────────────────────────────────────────────────────┐
│  POPUP CONFIG SESSION                               │
├─────────────────────────────────────────────────────┤
│  Nom: [Q1            ]                              │
│  Type: Qualifying  Durée: [5] min  OU  Tours: [ ]   │
├─────────────────────────────────────────────────────┤
│  CONFIGURATION CONTROLLERS                          │
│  ┌─────┬──────────────┬──────────────┐              │
│  │ Ctrl│ Pilote       │ Voiture      │              │
│  ├─────┼──────────────┼──────────────┤              │
│  │  1  │ [Select ▼]   │ [Select ▼]   │              │
│  │  2  │ [Select ▼]   │ [Select ▼]   │              │
│  │  3  │ [Select ▼]   │ [Select ▼]   │              │
│  │ ... │              │              │              │
│  └─────┴──────────────┴──────────────┘              │
├─────────────────────────────────────────────────────┤
│  Status: ○ Draft  ● Prêt                            │
├─────────────────────────────────────────────────────┤
│  [🗑️ Supprimer]  [🔄 Réinitialiser]                  │
├─────────────────────────────────────────────────────┤
│  [Annuler]                      [Enregistrer]       │
└─────────────────────────────────────────────────────┘

Actions selon status:
| Status | Supprimer | Réinitialiser |
|--------|-----------|---------------|
| `draft` | ✅ | ❌ (pas de data) |
| `ready` | ✅ | ❌ (pas de data) |
| `active` | ❌ | ✅ (reset laps) |
| `finishing` | ❌ | ❌ |
| `finished` | ✅ | ✅ (remet en draft) |
```

---

## Phases de Tour (Lap)

| Phase | Code | Description |
|-------|------|-------------|
| Essais Libres | `free` | Tours en practice |
| Qualifications | `qualif` | Tours en qualification |
| Course | `race` | Tours en course |

Les tours sont taggés avec leur phase pour le calcul des standings:
- `qualif` → utilisé pour le classement qualifications
- `race` → utilisé pour le classement courses
- `free` → non comptabilisé dans les standings

