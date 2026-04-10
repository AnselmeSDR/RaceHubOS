# Système de Phases Multi-Sessions

## Vue d'ensemble

Le système de phases permet à une session de gérer plusieurs types d'activités (essais libres, qualifications, course) avec des classements séparés pour chaque phase.

## Architecture

### Base de données (Prisma Schema)

#### Session
```prisma
model Session {
  // ...
  currentPhase    String       @default("practice") // Phase active : practice, qualif, race
  // ...
}
```

#### Lap
```prisma
model Lap {
  // ...
  phase       String   @default("practice") // Phase du tour : practice, qualif, race
  // ...

  @@index([sessionId, phase]) // Index pour optimiser les requêtes par phase
}
```

### API

#### Endpoint de classement
`GET /api/stats/leaderboard/drivers?sessionId={id}&phase={phase}`

**Paramètres :**
- `sessionId` (requis) : ID de la session
- `phase` (optionnel) : practice, qualif, ou race

**Tri par phase :**
- **Practice/Qualifying** : Classement par meilleur temps au tour (croissant)
- **Race** : Classement par nombre de tours (décroissant), puis meilleur temps

**Exemple de réponse :**
```json
{
  "success": true,
  "data": [
    {
      "position": 1,
      "driver": { "id": "...", "name": "John Doe" },
      "car": { "brand": "Ferrari", "model": "488" },
      "laps": 25,
      "bestLap": 45230,
      "lastLap": 45500
    }
  ]
}
```

#### Mise à jour de la phase
`PUT /api/sessions/:id`

**Body :**
```json
{
  "currentPhase": "qualif"
}
```

### Frontend (SessionDetail)

#### États
```javascript
const [activePhaseTab, setActivePhaseTab] = useState('practice')
const [phaseLeaderboards, setPhaseLeaderboards] = useState({
  practice: [],
  qualif: [],
  race: []
})
```

#### Fonctions principales

**loadAllLeaderboards()** : Charge les classements pour toutes les phases en parallèle

**handlePhaseChange(newPhase)** : Change la phase active de la session

## Flux d'utilisation

### 1. Création de session
```javascript
// La session démarre en phase "practice" par défaut
const session = {
  name: "Session GP Monaco",
  type: "practice",
  currentPhase: "practice", // Phase par défaut
  // ...
}
```

### 2. Enregistrement des tours
Lorsqu'un tour est enregistré, il est automatiquement associé à la phase active :
```javascript
{
  sessionId: "session-id",
  driverId: "driver-id",
  phase: session.currentPhase, // "practice", "qualif", ou "race"
  lapTime: 45230,
  // ...
}
```

### 3. Changement de phase
L'utilisateur peut changer la phase via le sélecteur dans le header :
```javascript
handlePhaseChange("qualif")
// Les nouveaux tours seront enregistrés en phase "qualif"
```

### 4. Consultation des résultats
Chaque onglet affiche le classement filtré par phase :
- **Essais libres** : Tours avec `phase = "practice"`
- **Qualifications** : Tours avec `phase = "qualif"`
- **Course** : Tours avec `phase = "race"`

## Interface utilisateur

### Header de session
- **Chronométre** : Temps écoulé depuis le démarrage
- **Sélecteur de phase** : Dropdown pour changer la phase active
- **Boutons de contrôle** : Play, Pause, Stop, Redémarrer (icônes uniquement)

### Onglets de phase
- **Essais libres** (bleu) : Classement par meilleur temps
- **Qualifications** (violet) : Classement par meilleur temps
- **Course** (vert) : Classement par tours complétés

Chaque onglet affiche :
- Badge avec le nombre de pilotes ayant des tours
- Indicateur "Phase active" si c'est la phase courante
- Classement avec podium stylisé (or/argent/bronze)
- Temps au millième de seconde

## Avantages

1. **Séparation claire** : Chaque phase garde son historique indépendant
2. **Flexibilité** : Pas besoin de créer plusieurs sessions
3. **Tri intelligent** : Classement adapté au type de phase
4. **Temps réel** : Mise à jour automatique via WebSocket
5. **UX intuitive** : Navigation simple entre les phases

## Limitations actuelles

- Une seule session peut être active à la fois
- Les tours ne peuvent pas être déplacés d'une phase à une autre
- La phase ne peut pas être changée une fois la session terminée

## Évolutions possibles

1. **Gestion des pénalités** : Ajouter des pénalités de temps par phase
2. **Exportation** : Exporter les résultats par phase en PDF/CSV
3. **Historique** : Afficher l'historique des changements de phase
4. **Statistiques** : Graphiques de progression par phase
5. **Multi-sessions** : Lier plusieurs sessions (practice → quali → race)
