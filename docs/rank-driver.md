# Système de Rating Pilote — Plan d'implémentation

Document de référence pour l'implémentation du système ELO multi-joueurs dans RaceHubOS, inspiré du système de la "Rating CR League" (cf. `Rating CR League.xlsx`).

---

## 1. Algorithme — Formule mathématique

### Principe : ELO multi-joueurs

À chaque course, l'algorithme compare la **performance attendue** (selon le rating de chaque pilote) avec la **performance réelle** (la position finale). La différence détermine le gain/perte de rating.

### Formules

**Probabilité ELO classique** que le pilote A batte le pilote B :

```
P(A bat B) = 1 / (1 + 10^((R_B - R_A) / 400))
```

- `R_A`, `R_B` = ratings des deux pilotes
- `400` = échelle ELO standard (différence de 400 points → ~91% de chance pour le mieux classé)

**Score réel** d'un pilote pour une course donnée :

```
Score_réel = n - position
```

- `n` = nombre total de participants
- `position` = classement final (1 = premier)
- Donc `Score_réel` = nombre de pilotes battus

**Score attendu** d'un pilote :

```
Score_attendu = Σ P(pilote bat adversaire_i) pour tous les adversaires
```

En pratique dans la formule Excel, on somme P contre **tous les participants** (incluant soi-même qui vaut 0.5) puis on retire 0.5 pour ne garder que les vrais adversaires.

**Delta rating final** :

```
Δ = (K / (n - 1)) × (Score_réel - Score_attendu)
```

- `K` = coefficient de la course (importance)
- `n - 1` = nombre d'adversaires (normalisation)
- Arrondi à 1 décimale

**Nouveau rating** = `Ancien rating + Δ`

### Exemple concret

6 pilotes, K=40, ton rating = 1050, tu finis 2e :
- Score réel = 6 − 2 = **4**
- Score attendu (calculé) ≈ **3.5**
- Différence brute = 4 − 3.5 = **+0.5**
- × K/(n−1) = × 40/5 = **×8**
- **Δ = +4 points** → nouveau rating = 1054

---

## 2. Coefficients K

Le coefficient K détermine l'importance d'une course sur le rating.

| Type de session | K | Justification |
|-----------------|---|---------------|
| **Practice** | — | Pas de calcul de rating |
| **Balancing** | — | Pas de calcul de rating |
| **Qualif événement** | **10** | Bouge peu le rating (échauffement) |
| **Course officielle simple** (sans qualifs) | **20** | Course standard du championnat |
| **Course événement** (finale, gros enjeu) | **40** | Course majeure, impact fort sur le rating |

Configurable par session via `Session.kCoefficient`, ou hérité du `Championship` selon le type.

---

## 3. Tiers (catégories)

Le rang attribué à chaque pilote est calculé après chaque session selon son rating global :

| Tier | Critère | Couleur recommandée | Icône |
|------|---------|---------------------|-------|
| 🏆 **Platinium** | Top 5% du classement | `#A78BFA` (violet) | 💎 |
| 🥇 **Gold** | Top 20% | `#FBBF24` (or) | 🥇 |
| 🥈 **Silver** | Top 60% | `#94A3B8` (argent) | 🥈 |
| 🥉 **Bronze** | A participé à ≥ 2 jours de course (peut monter à 3 si peu de participations) | `#A16207` (bronze) | 🥉 |
| 🆕 **Rookie** | Nouveau venu (< 2 sessions comptabilisées) | `#10B981` (vert) | 🆕 |

**Rating initial** = `1000` pour tout nouveau pilote.

---

## 4. Modèle de données (Prisma)

### Migration 1 : Champs sur `Driver`

```prisma
model Driver {
  // ... champs existants
  rating          Float    @default(1000)
  tier            String?  // "platinium" | "gold" | "silver" | "bronze" | "rookie"
  ratingUpdatedAt DateTime?

  ratingChanges   RatingChange[]
}
```

### Migration 2 : Table `RatingChange` (historique)

```prisma
model RatingChange {
  id            String   @id @default(cuid())
  driverId      String
  sessionId     String
  oldRating     Float
  newRating     Float
  delta         Float
  position      Int      // Position finale dans la course
  participants  Int      // Nombre de pilotes participants
  kCoefficient  Float    // K utilisé pour ce calcul
  createdAt     DateTime @default(now())

  driver        Driver   @relation(fields: [driverId], references: [id])
  session       Session  @relation(fields: [sessionId], references: [id])

  @@index([driverId, createdAt])
  @@index([sessionId])
}
```

### Migration 3 : Coefficient K sur `Session`

```prisma
model Session {
  // ... champs existants
  kCoefficient Float?  // null = défaut selon type
  ratingChanges RatingChange[]
}
```

### Migration 4 : Coefficients K par défaut sur `Championship` (optionnel)

```prisma
model Championship {
  // ... champs existants
  qualifKCoefficient    Float @default(10)
  raceKCoefficient      Float @default(20)
  finalKCoefficient     Float @default(40)
}
```

---

## 5. Service backend

### `packages/backend/src/services/EloService.js`

Squelette du service :

```javascript
import { PrismaClient } from '@prisma/client';

const INITIAL_RATING = 1000;
const TIER_THRESHOLDS = {
  platinium: 0.05, // Top 5%
  gold: 0.20,      // Top 20%
  silver: 0.60,    // Top 60%
  // bronze : participation-based
  // rookie : default for new
};

const DEFAULT_K = {
  qualif: 10,
  race: 20,
  event_final: 40,
};

export class EloService {
  constructor(prisma) {
    this.prisma = prisma;
  }

  /**
   * Probabilité ELO que A batte B.
   */
  expectedScore(ratingA, ratingB) {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  }

  /**
   * Calcule les deltas pour une session.
   * @param {Array<{driverId, rating, position}>} participants
   * @param {number} K
   * @returns {Array<{driverId, oldRating, newRating, delta}>}
   */
  computeSessionDeltas(participants, K) {
    const n = participants.length;
    if (n < 2) return participants.map(p => ({
      driverId: p.driverId,
      oldRating: p.rating,
      newRating: p.rating,
      delta: 0
    }));

    return participants.map(player => {
      const scoreReal = n - player.position;
      const expectedSum = participants.reduce(
        (acc, other) => acc + this.expectedScore(player.rating, other.rating),
        0
      ) - 0.5; // retirer la self-comparison

      const delta = Math.round(((K / (n - 1)) * (scoreReal - expectedSum)) * 10) / 10;
      return {
        driverId: player.driverId,
        oldRating: player.rating,
        newRating: Math.round((player.rating + delta) * 10) / 10,
        delta,
      };
    });
  }

  /**
   * Détermine le K selon la session.
   */
  getKForSession(session) {
    if (session.kCoefficient != null) return session.kCoefficient;
    if (session.type === 'qualif') return DEFAULT_K.qualif;
    if (session.type === 'race') return DEFAULT_K.race;
    return DEFAULT_K.race;
  }

  /**
   * Applique les résultats d'une session terminée :
   * - calcule les deltas
   * - met à jour Driver.rating
   * - crée les RatingChange (audit)
   * - recalcule les tiers
   */
  async applySessionResults(sessionId) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        drivers: { include: { driver: true } }
      }
    });

    if (!session) throw new Error('Session not found');

    // Skip si pas une course/qualif
    if (!['race', 'qualif'].includes(session.type)) return;

    const K = this.getKForSession(session);
    const participants = session.drivers
      .filter(sd => sd.driver && sd.finalPos != null)
      .map(sd => ({
        driverId: sd.driverId,
        rating: sd.driver.rating ?? INITIAL_RATING,
        position: sd.isDNF ? session.drivers.length : sd.finalPos,
      }));

    const deltas = this.computeSessionDeltas(participants, K);

    // Persistence transactionnelle
    await this.prisma.$transaction([
      ...deltas.map(d =>
        this.prisma.driver.update({
          where: { id: d.driverId },
          data: { rating: d.newRating, ratingUpdatedAt: new Date() }
        })
      ),
      ...deltas.map(d =>
        this.prisma.ratingChange.create({
          data: {
            driverId: d.driverId,
            sessionId,
            oldRating: d.oldRating,
            newRating: d.newRating,
            delta: d.delta,
            position: participants.find(p => p.driverId === d.driverId).position,
            participants: participants.length,
            kCoefficient: K,
          }
        })
      ),
    ]);

    await this.recalculateTiers();
    return deltas;
  }

  /**
   * Recalcule les tiers de tous les pilotes selon les seuils.
   */
  async recalculateTiers() {
    const drivers = await this.prisma.driver.findMany({
      where: { deletedAt: null },
      include: { _count: { select: { sessions: true } } },
      orderBy: { rating: 'desc' },
    });

    const total = drivers.length;
    const platinium = Math.ceil(total * TIER_THRESHOLDS.platinium);
    const gold = Math.ceil(total * TIER_THRESHOLDS.gold);
    const silver = Math.ceil(total * TIER_THRESHOLDS.silver);

    const updates = drivers.map((d, idx) => {
      let tier;
      if (d._count.sessions < 2) tier = 'rookie';
      else if (idx < platinium) tier = 'platinium';
      else if (idx < gold) tier = 'gold';
      else if (idx < silver) tier = 'silver';
      else tier = 'bronze';
      return this.prisma.driver.update({
        where: { id: d.id },
        data: { tier },
      });
    });

    await this.prisma.$transaction(updates);
  }
}
```

---

## 6. Hook sur fin de session

Dans `SessionService.finishSession()`, après la sauvegarde des positions finales :

```javascript
// finishSession() — dans SessionService.js

async finishSession(reason) {
  // ... code existant : sauvegarde des positions, isDNF, etc.

  // Appliquer le rating ELO (sauf practice/balancing)
  if (this.currentPhase === 'race' || this.currentPhase === 'qualif') {
    try {
      await this.eloService.applySessionResults(this.activeSessionId);
    } catch (err) {
      console.warn('[SessionService] ELO computation failed:', err.message);
    }
  }

  // ... reste du code
}
```

Injection du service dans le constructeur :

```javascript
constructor(io, eloService) {
  // ...
  this.eloService = eloService;
}
```

---

## 7. Endpoints API

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/rankings` | Classement global (rating desc) + tier |
| `GET` | `/api/rankings/championship/:id` | Ranking spécifique à un championnat |
| `GET` | `/api/drivers/:id/rating-history` | Historique des changements d'un pilote (pour graph) |
| `GET` | `/api/sessions/:id/rating-changes` | Deltas appliqués à une session donnée |
| `PATCH` | `/api/sessions/:id/k-coefficient` | Modifier K (avant fin de session) |
| `POST` | `/api/admin/recalculate-tiers` | Recalculer manuellement les tiers (admin) |
| `POST` | `/api/admin/backfill-ratings` | Rejouer toutes les sessions passées (admin) |

---

## 8. Frontend

### Page principale : `pages/Rankings.jsx`

Listing du classement avec colonnes :
- Position (1, 2, 3...)
- Badge Tier
- Nom pilote
- Rating
- Δ depuis la dernière course (badge vert/rouge)
- Nombre de courses
- Tendance (icône 📈 / 📉 / ➡️)

### Composant `RatingBadge.jsx`

Affiche un badge tier avec icône + couleur. Réutilisable dans :
- Listings pilotes
- Cards podium
- Détail de session
- Profil pilote

### Composant `RatingChart.jsx` (Recharts)

Graphique ligne de l'évolution du rating d'un pilote sur le temps. Inclus dans le profil pilote.

### Carte "Deltas de session" sur le podium

Après une course terminée, afficher les changements de rating :

```
🏁 C200 Finale (K=40)
─────────────────────────────────
🥇 Romain   +8.2  (1064.3 → 1072.5)
🥈 Anselme  +3.5  (1021.3 → 1024.8)
🥉 Lisa     -2.1  (997.9 → 995.8)
4. Audrey   -9.6  (1009.3 → 999.7)
```

### Configuration dans Settings

```
─── Rating ───────────────────────
Rating initial nouveau pilote : [1000]
K Course officielle           : [20]
K Qualif                      : [10]
K Course événement            : [40]

Seuils tiers :
  Platinium : Top [5 %]
  Gold      : Top [20 %]
  Silver    : Top [60 %]
  Bronze    : ≥ [2] participations
```

---

## 9. Migration des données existantes

Trois options pour gérer les sessions déjà jouées :

| Option | Description | Avantages | Inconvénients |
|--------|-------------|-----------|---------------|
| **A. Reset** | Tout le monde commence à 1000, on n'applique pas l'historique | Simple, propre | On perd l'historique |
| **B. Backfill** | Script qui rejoue chronologiquement chaque session passée pour calculer les ratings actuels | Classement initial réaliste | Plus de dev (~2-3h) |
| **C. Hybrid** | Reset à 1000, mais on garde l'historique des courses pour stats brutes | Compromis | Moins riche que B |

**Recommandation** : **Option B (Backfill)** pour avoir un classement qui a du sens dès le départ.

Script de backfill :
```javascript
// scripts/backfill-ratings.js
async function backfillRatings() {
  // 1. Reset tous les drivers à 1000
  await prisma.driver.updateMany({ data: { rating: 1000 } });
  await prisma.ratingChange.deleteMany({});

  // 2. Charger toutes les sessions finies, par ordre chronologique
  const sessions = await prisma.session.findMany({
    where: {
      status: 'finished',
      type: { in: ['race', 'qualif'] },
    },
    orderBy: { finishedAt: 'asc' },
  });

  // 3. Pour chaque session, appliquer le rating
  for (const session of sessions) {
    await eloService.applySessionResults(session.id);
  }

  console.log(`Backfilled ${sessions.length} sessions`);
}
```

---

## 10. Tests à prévoir

### Tests unitaires `EloService`

```javascript
describe('EloService', () => {
  test('expectedScore returns 0.5 for equal ratings', () => {
    expect(elo.expectedScore(1000, 1000)).toBeCloseTo(0.5);
  });

  test('higher rating has > 0.5 chance', () => {
    expect(elo.expectedScore(1100, 1000)).toBeGreaterThan(0.5);
  });

  test('100pt diff gives ~64% expected', () => {
    expect(elo.expectedScore(1100, 1000)).toBeCloseTo(0.64, 1);
  });

  test('400pt diff gives ~91% expected', () => {
    expect(elo.expectedScore(1400, 1000)).toBeCloseTo(0.91, 1);
  });

  test('Audrey Race 1: 1009.3 wins among 6 → +4.9', () => {
    const participants = [
      { driverId: 'romain', rating: 1064.3, position: 2 },
      { driverId: 'audrey', rating: 1009.3, position: 1 },
      // ... autres participants
    ];
    const deltas = elo.computeSessionDeltas(participants, 10);
    const audrey = deltas.find(d => d.driverId === 'audrey');
    expect(audrey.delta).toBeCloseTo(4.9, 1);
  });

  test('Sum of deltas should be 0 (zero-sum)', () => {
    const deltas = elo.computeSessionDeltas(testParticipants, 10);
    const sum = deltas.reduce((acc, d) => acc + d.delta, 0);
    expect(Math.abs(sum)).toBeLessThan(0.5); // arrondis tolerance
  });
});
```

### Tests d'intégration

- Une session terminée déclenche bien le calcul de rating
- Les `RatingChange` sont bien créés en base
- Les tiers sont recalculés correctement après chaque session
- Un pilote DNF est compté en dernière position
- Les sessions practice/balancing n'affectent pas le rating

---

## 11. Estimation effort

| Tâche | Complexité | Estimation |
|-------|-----------|-----------|
| Migrations Prisma (Driver + RatingChange + Session.K) | 🟢 | 30 min |
| `EloService.js` + tests unitaires | 🟡 | 2-3 h |
| Hook dans `SessionService.finishSession` | 🟢 | 30 min |
| Endpoints API | 🟢 | 1 h |
| Page `Rankings.jsx` + composant `RatingBadge` | 🟡 | 3-4 h |
| `RatingChart` (Recharts) | 🟡 | 2 h |
| Carte deltas dans le podium de fin de course | 🟢 | 1 h |
| Configuration Settings (K, seuils tiers) | 🟢 | 1 h |
| Backfill historique (option B) | 🔴 | 2-3 h |
| **Total** | | **~12-15 h** |

---

## 12. Ordre d'implémentation recommandé

1. **Phase 1 — Fondations mathématiques (jour 1)**
   - Migration Prisma
   - `EloService.js` + tests unitaires
   - Vérification avec les valeurs du fichier Excel

2. **Phase 2 — Intégration (jour 2)**
   - Hook dans `SessionService.finishSession`
   - Endpoints API basiques (`GET /api/rankings`)
   - Test end-to-end sur une vraie session

3. **Phase 3 — UI (jour 3)**
   - Page Rankings avec liste + tier badges
   - Composant `RatingBadge`
   - Affichage du rating dans le profil pilote

4. **Phase 4 — Enrichissement (jour 4)**
   - Graph d'évolution `RatingChart`
   - Carte des deltas dans le podium
   - Settings configurables

5. **Phase 5 — Migration (jour 5)**
   - Backfill des sessions passées
   - Recalcul des tiers
   - Validation des chiffres obtenus

---

## 13. Particularités à considérer

1. **DNF = dernière position** dans le calcul ELO (pas exclu de la course). Ça pénalise correctement les abandons.

2. **Pas de rating sur Practice/Balancing** : ces sessions ne sont pas compétitives donc n'affectent pas le rating.

3. **Le rating est zero-sum** : la somme des Δ d'une course est ≈ 0 (à l'arrondi près). Pas d'inflation de points.

4. **Un nouveau pilote** : démarre à 1000. Tier "Rookie" jusqu'à sa 2e participation. Les premières courses font fortement bouger son rating (car ratings autres pilotes sont stables).

5. **Coefficients K modifiables par session** : permet d'augmenter l'enjeu d'une finale ou d'un événement spécial sans changer le défaut global.

6. **Recalcul des tiers** : après chaque session (mais à terme on pourrait le faire en background si trop de pilotes).

7. **Decay d'inactivité non prévu dans la base** : si on veut l'ajouter, prévoir un job cron qui décroît le rating des pilotes inactifs > X jours.

---

## 14. Référence externe

- Fichier source : `~/Downloads/Rating CR League.xlsx`
- Formule originale ELO : Arpad Elo, *The Rating of Chessplayers* (1978)
- Variante multi-joueurs utilisée dans : iRacing, certaines ligues de Carrera digital

---

*Document créé le 2026-05-13.*
