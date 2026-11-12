# Plan : divisions (pilotes) et catégories (voitures)

Maquettes validées : `docs/maquettes/divisions.html`.

**État (2026-11-12)** : fait en 1.29.0, sauf la montée/descente et les points d'extension des add-ons (« Plus tard »).
Écarts avec le plan : les filtres partagés s'appellent `DivisionFilters` (deux lignes, divisions puis catégories) ; dans
un championnat ils sont dans `ChampionshipConfigModal`, enregistrés dès le choix, et `ChampionshipParticipantsPanel`
ne fait que les appliquer ; `GET /api/divisions?scope=` filtre la page Divisions.
Ajouté ensuite : la page d'une division (`docs/maquettes/division-page.html`), membres ajoutés et retirés sur place, export Excel des divisions et de leurs liens.

## Objectif

Classer les pilotes en **divisions** (GOLD, SILVER…) et les voitures en **catégories** (GT3, DTM…), 0, 1 ou plusieurs
par fiche. Les divisions **remplacent les équipes**, déjà utilisées comme divisions (les six équipes actuelles en
sont). Elles servent à :

- marquer pilotes et voitures d'une pastille : cartes, fiches, leaderboard ;
- filtrer les listes de pilotes et de voitures sur une ou plusieurs divisions/catégories, ou « sans » ;
- restreindre les sélecteurs de pilotes et de voitures d'un championnat, choix gardés sur le championnat ;
- plus tard (hors de ce commit) : monter ou descendre de division en fin de championnat.

## Décisions

- Dans le cœur ; un add-on doit pouvoir créer un objet du même genre (voir plus bas).
- Un seul objet `Division`, distingué par `scope` (`driver` | `car`) ; l'interface dit « Division » pour les pilotes,
  « Catégorie » pour les voitures.
- Divisions et catégories choisies gardées sur le championnat.
- Leaderboard : la division du pilote et la catégorie de la voiture (à alléger à la prochaine refonte du leaderboard).
- Paramètres de requête en camelCase, comme le reste de l'API (`divisionId`).
- Division de pilote : toujours une pastille pleine de sa couleur (texte sombre sur une couleur claire). Catégorie de
  voiture : toujours fond blanc, bordure et texte de sa couleur.
- Données de départ fournies (voir « Données de départ »).
- Un seul commit, sauf la montée/descente.

## Modèle

```prisma
model Division {
  id        String    @id @default(cuid())
  name      String
  shortName String?   // pastille (GOLD, GT3) ; le nom sinon
  color     String    @default("#6B7280")
  img       String?   // logo, repris des équipes
  scope     String    // "driver" | "car" — DivisionScope, @racehubos/shared
  order     Int       @default(0) // échelon : ordre des listes et filtres, échelle de la montée/descente
  deletedAt DateTime?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  drivers       DriverDivision[]
  cars          CarDivision[]
  championships ChampionshipDivision[]
  extras        DivisionExtra[]
}

model DriverDivision {   // idem CarDivision (carId), ChampionshipDivision (championshipId)
  driverId   String
  divisionId String
  driver     Driver   @relation(fields: [driverId], references: [id], onDelete: Cascade)
  division   Division @relation(fields: [divisionId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now()) // depuis quand : historique des montées plus tard
  @@id([driverId, divisionId])
}
```

- Tables de liaison explicites : elles porteront date et historique.
- `scope` en texte, valeurs dans `packages/shared`, jamais d'enum Prisma.

### Migration des équipes (une migration SQL)

- Chaque `Team` devient une `Division` `scope = 'driver'` (même id, nom, couleur, logo, suppression douce) ; `order`
  suit l'ordre alphabétique, à reprendre à la main.
- `Driver.teamId` devient une ligne `DriverDivision`.
- `TeamExtra` devient `DivisionExtra` (mêmes lignes).
- Puis suppression de `Team`, `TeamExtra` et `Driver.teamId`.
- Les logos restent où ils sont : `/api/img/teams/…` reste servi ; les nouveaux vont dans `divisions`.

### Données de départ

- Insérées une seule fois, par la migration : toute base en profite (installation neuve, PC de course, `dev.db`), et
  une division supprimée par l'utilisateur ne revient pas.
- Catégories de voitures : GT3, GTE, DTM, Formule, Classique (échelons 1 à 5).
- Divisions de pilotes, seulement si aucune équipe n'existait : PLATINIUM, GOLD, SILVER, BRONZE (échelons 1 à 4).
- `prisma/seed.js` (données de développement) : les équipes deviennent des divisions, les voitures reçoivent une
  catégorie.

## Développement

### Serveur

- `packages/shared` : `DivisionScope`, `isDivisionScope`.
- `routes/divisions.js` (remplace `routes/teams.js`) : liste paginée (`listPage`, filtre `scope`, tri nom, échelon,
  nombre de pilotes/voitures), création, modification, suppression douce, restauration, purge (`lib/softDelete.js`).
- `routes/drivers.js`, `routes/cars.js` : `divisionIds` à la création et à la modification (400 si inconnue ou d'un autre
  `scope`) ; divisions dans la liste et la fiche ; filtre `divisionId=a,b` (au moins une), `none` = sans ; tri de la
  colonne par l'échelon de la première division (remplace `byTeamName`).
- Championnats : `divisionIds` à la création et dans la configuration (`ChampionshipDivision`), renvoyés avec le détail.
- Sessions : divisions du pilote et catégories de la voiture dans les entrées (`lib/sessions/storage.js`, `liveState`).
- Ce qui lisait l'équipe : `utils/imageUrl.js`, `lib/referenceDriver.js`, exports (`exportQueries`, `entityExport`,
  `excel/standings`, `excel/sessionSheets`, `excel/scope` : « Équipe » → « Divisions »), `stats/entities.js`,
  `upload.js` et `coreRoutes.js` (type d'image `divisions`).
- `/api/stats/leaderboard/teams` : supprimé (aucune page ne l'appelle).
- Add-ons : `ctx.extra` perd `team`, gagne `division` (aucun add-on connu ne l'utilise).
- Tests : CRUD, `scope` refusé, filtres (une, plusieurs, `none`), migration des équipes (base de test avec équipes),
  championnat avec divisions, entrées de session.

### Interface (maquette entre parenthèses)

- Menu : « Équipes » devient « Divisions », `/teams` redirige (1).
- Page Divisions, onglets Pilotes/Voitures, cartes et liste (2, 3) ; formulaire (4). Remplace `Teams.jsx` et
  `components/team/`.
- Composants partagés : `DivisionBadge` (pleine ou contour selon `scope`, contraste automatique), `DivisionPicker` (choix
  multiple), `DivisionFilter` (filtres de l'assistant et de la configuration).
- Formulaires pilote et voiture (5), cartes (6), en-têtes des fiches (7), colonnes filtrables des listes (8).
- Leaderboard : `RowIdentity` (9).
- Assistant, étape Pilotes : filtres, sélecteurs restreints, « hors division / hors catégorie » ; la voiture préférée
  n'est proposée que si elle est dans les catégories choisies (10).
- Championnat : pastilles dans l'en-tête, filtres dans `ChampionshipParticipantsPanel` (11).
- Écrans pilotes (`components/driverDisplays/*`, `CRUDDisplays`) : la pastille d'équipe devient celles des divisions.
- Textes : namespace `divisions` (remplace `teams`) en fr/en/de, `glossary` (division, catégorie).
- Tests Vitest et Playwright de chaque écran ; `german-layout` pour les filtres et pastilles.

### Documentation

- `docs/ADDONS.md` : record type `division` à la place de `team` ; section « créer un objet » (ci-dessous).
- `CLAUDE.md` du projet, changelog (une entrée).

## Créer un objet depuis un add-on

Ce qu'un add-on peut déjà faire : ses tables (`ctx.migrate`, base propre avec le cœur attaché en `core`), son API
(`ctx.router`), ses pages et entrées de menu, et réutiliser les composants du cœur (`ListPage`, `FilterHeader`, `Modal`…).
Il peut donc créer un objet avec sa liste et sa carte, et le relier aux pilotes par sa propre table de liaison.

Ce qui manque, c'est de **le montrer et le filtrer dans les écrans du cœur** sans overrides. Proposition : des points
d'extension nommés, que les divisions du cœur utilisent elles-mêmes (garantie qu'ils marchent) :

| Point                          | Où                                                    | Ce que l'add-on fournit                         |
| ------------------------------ | ----------------------------------------------------- | ----------------------------------------------- |
| `driver.badges`, `car.badges`  | cartes, en-têtes de fiche, leaderboard, assistant     | un composant qui reçoit le pilote / la voiture  |
| `driver.form`, `car.form`      | formulaires pilote et voiture                         | un champ, enregistré par l'add-on à la sauvegarde |
| `drivers.columns`, `cars.columns` | listes                                             | une colonne et son filtre (paramètre de requête) |
| filtre serveur                 | `GET /api/drivers`, `/api/cars`                       | `ctx.filters.driver(param, values => ids)`      |

Côté web, l'add-on les déclare dans `web/index.jsx` (`slots: { 'driver.badges': MyBadges }`) ; côté serveur, le filtre
renvoie les ids retenus, que la route du cœur ajoute à sa requête (`id in …`) avant la pagination.

Plus tard, hors de ce commit. Principe retenu : un add-on ne remplace pas le filtre du cœur, il y ajoute ses
éléments (options, colonnes, pastilles).

## Plus tard : montée et descente

- En fin de championnat : points par classement, proposition « les N premiers montent, les N derniers descendent »
  dans l'échelle des divisions du championnat (`order`), validée à la main.
- Historique `DivisionChange` (pilote, de, vers, championnat, date).
- Prêt dans le modèle : `order`, dates de liaison, `ChampionshipDivision`.
