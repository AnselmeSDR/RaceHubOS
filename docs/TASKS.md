# RaceHubOS - Tâches à venir

> Liste des tâches concrètes à implémenter, organisées par domaine.

---

## 📊 Statistiques & Résultats

### TASK-01: Enrichir la section "Meilleurs moments" des résultats de championnat
**Domaine**: Frontend + Backend
**Description**: Ajouter plusieurs nouvelles stats dans la section **"Meilleurs moments"** des résultats d'un championnat.
**Nouvelles stats à ajouter**:
- **Distance parcourue par le leader** : `nbTours × longueurCircuit`, affichée en km avec 3 décimales
  - Exemple : finale → 172 tours × 23.03 m/tour = **3.445 km**
  - Vérifier la présence d'un champ `length` (en mètres) sur le modèle `Track`, sinon l'ajouter
- **Écart le plus serré** : plus petit écart entre 2 voitures sur 1 tour
- **Pole position** : meilleur temps de qualif du championnat
- **Nouveau record personnel** : pilote(s) ayant battu leur best lap pendant le championnat

### TASK-02: Colonne "Championnat" dans les stats
**Domaine**: Frontend
**Statut**: ✅ Fait en v1.17.0
**Description**: Ajouter une colonne dans le tableau des statistiques indiquant le championnat dans lequel le temps a été réalisé.
**Action**:
- ✅ Backend : `championship` joint dans la requête stats (+ tri, y compris en mode dédupliqué)
- ✅ Frontend : colonne dans le tableau, cliquable vers la fiche du championnat
- ✅ Filtre par championnat, avec option « Hors championnat » et combinaison de plusieurs championnats

### TASK-03: Ajouter "Équilibrage" dans le filtre de sessions + rendre le filtre dynamique
**Domaine**: Frontend + Backend
**Description**: Le filtre de sessions propose aujourd'hui *Essais / Qualification / Course*. Il faut **ajouter "Équilibrage"**, et faire en sorte que le filtre se mette à jour **automatiquement** si on ajoute un nouveau mode de session à l'avenir.
**Action**:
- Centraliser les types de session dans un **enum** unique (Prisma + côté front partagé)
  - Pistes : enum Prisma `SessionType` / constants TS partagées
- Le composant de filtre lit la liste des types depuis cet enum (pas de hardcode)
- Ajouter `BALANCING` (ou nom équivalent) à l'enum
- Vérifier les libellés i18n associés (un libellé par type)
- Audit : repérer tous les endroits qui listent en dur les types de session pour les brancher sur la source unique

### TASK-04: Centraliser tous les autres champs "stringly-typed" en enums
**Domaine**: Frontend + Backend
**Description**: Même problème que TASK-03 : plusieurs champs de la base sont des `String` libres avec des valeurs en dur disséminées dans le code. Audit + migration vers une source unique (enum Prisma + constants partagées front).
**Candidats identifiés** (à l'audit de la base actuelle) :
- `Session.status` → `draft | ready | active | finishing | finished` (utilisé partout : SessionContext, SessionSection, SessionConfigModal, etc.)
- `Session.type` → `practice | qualif | race | balancing` (déjà couvert par TASK-03, à fusionner)
- `Session.fuelMode` → `OFF | ...` (à inventorier dans SessionForm)
- `Championship.status` → `planned | ...` (valeurs à inventorier)
- `Championship.mode` → `manual | auto`
- `Lap.phase` → vérifier les valeurs utilisées (lié au type de session ?)
**Action**:
- Inventorier les valeurs réellement utilisées pour chaque champ (grep `=== 'xxx'`, valeurs par défaut Prisma)
- Créer les enums Prisma correspondants (attention : migration SQLite — les enums Prisma sont stockés en string mais validés)
- Exposer un module partagé (ex. `packages/shared/enums.ts`) consommé par front + back
- Remplacer les comparaisons hardcodées par les constants
- Vérifier les libellés i18n associés
**Bénéfice**: ajouter une valeur (ex. nouveau status, nouveau mode championnat) ne nécessitera plus de chasser les `=== 'xxx'` dans tout le code.

### TASK-05: Sélection d'un circuit principal dans les paramètres
**Domaine**: Frontend + Backend
**Description**: Permettre de choisir un circuit "principal" pour que les stats des pilotes et la page principale (dashboard) soient cohérentes.
**Action**:
- Ajouter `mainTrackId` dans les settings
- Filtrer la page principale + stats pilotes sur ce circuit par défaut
- **Afficher clairement sur le dashboard le circuit utilisé** pour les stats affichées (badge / sous-titre du bloc stats, ex. *"Stats sur le circuit : Nürburgring"*)
- Si aucun circuit principal n'est défini : afficher un état explicite (ex. *"Aucun circuit principal sélectionné"* + lien vers les paramètres)

### TASK-06: Option "Best par pilote" dans la page Statistiques
**Domaine**: Frontend
**Description**: Sur la **page Statistiques**, ajouter une option "Meilleur pilote" (en plus de l'existante "Meilleur par pilote/voiture") pour n'afficher chaque pilote qu'une seule fois avec son meilleur temps.
**Note**: à ne pas confondre avec TASK-07 qui couvre la même logique mais dans le **classement d'une course/championnat**.

### TASK-07: Option de classement par "Best par pilote" dans le classement général d'une session
**Domaine**: Frontend + Backend
**Description**: Dans le **classement général affiché pour chaque session** (essais, qualif, course, équilibrage), ajouter une option setting pour basculer entre :
- Classement par combo `pilote × voiture` (actuel — autant d'entrées que de combinaisons utilisées)
- Classement `best par pilote` (un pilote = une seule entrée avec son meilleur résultat)
**Note**: s'applique à toutes les sessions, peu importe leur type ou si elles font partie d'un championnat.

### TASK-08: 🐛 Bug — Temps orphelins après suppression d'un circuit
**Domaine**: Backend
**Description**: J'ai supprimé le circuit "Test" mais les temps associés sont toujours visibles dans les stats.
**Action**:
- Soit cascade delete des Laps liés
- Soit filtrer dans les requêtes stats les laps dont le circuit n'existe plus
- Choisir la stratégie selon le besoin (historique vs nettoyage)

---

## 🎨 UI / UX

### TASK-09: Réorganiser le menu — Historique au-dessus de Paramètres
**Domaine**: Frontend
**Description**: Déplacer le bouton "Historique" pour qu'il soit positionné au-dessus de "Paramètres" dans la sidebar/menu.

### TASK-10: Pseudo 3 lettres pour les pilotes
**Domaine**: Frontend + Backend
**Description**: Ajouter un champ `shortName` / `pseudo` (3 lettres) sur le modèle Driver.
**Action**:
- Migration Prisma : ajouter `shortName String?` (3 chars)
- Form édition pilote
- Utiliser dans les affichages compacts (podium, leaderboard)

### TASK-11: Support des images PNG transparentes + choix du masque
**Domaine**: Frontend
**Description**: Supporter les images PNG sans fond, et permettre de choisir le masque (rond, carré, hexagone, etc.) appliqué selon le type d'image (pilote, voiture, etc.).
**Action**:
- Détection automatique de la transparence
- Setting masque par type d'entité

### TASK-12: Damier à côté des pilotes ayant terminé
**Domaine**: Frontend
**Description**: Afficher une icône damier (🏁) à côté du pilote dès qu'il a franchi la condition de fin (ex. dernier tour effectué).

---

## 🔊 Sons & Voix

### TASK-13: Sons de fin de course (victoire + fin)
**Domaine**: Frontend + Backend
**Description**: Deux sons distincts :
1. **Son de victoire** dès que la condition de réussite est atteinte (ex. leader franchit la ligne finale)
2. **Son de fin de course** à la fin de la grace period

### TASK-14: Voix — Annonce du changement de leader
**Domaine**: Frontend
**Description**: TTS qui annonce le changement de leader en course. Ex. *"Anselme SDR prend la tête"*.

### TASK-15: Voix — Annonce du dernier tour (setting)
**Domaine**: Frontend
**Description**: TTS qui annonce quand un pilote entame son dernier tour.
**Action**:
- Setting on/off
- Détection : tour actuel == tour max - 1

### TASK-16: Commentateurs — Pronostics avant course (déclenchement manuel)
**Domaine**: Frontend
**Description**: Avant le départ d'une course, permettre à l'utilisateur de faire parler les commentateurs (TTS) qui font des pronostics basés sur les stats du championnat en cours.
**Déclenchement**: **bouton manuel** sur l'écran de pre-race — **pas de lecture automatique** au lancement de la course.
**Action**:
- Ajouter un bouton dédié sur l'écran pre-race (ex. *"Pronostics commentateurs 🎙️"*)
- Générer un script depuis les stats (leader actuel, formes du moment, écarts, etc.)
- Lecture TTS uniquement au clic

---

## 🏁 Course / Logique

### TASK-17: Mettre vitesse à 0 en fin de course
**Domaine**: Backend
**Description**: À la fin de course (après grace period), envoyer la commande vitesse=0 à toutes les voitures pour stopper la course.
**Action**:
- Étendre la logique de fin de course existante (auto-throttle déjà implémenté pour pilotes finis)
- Tester que la CU retourne bien le **status `stopped` 8-9**

### TASK-18: Détection du passage en pitlane
**Domaine**: Backend
**Description**: Détecter le passage d'une voiture en pitlane via le protocole CU.
**Action**:
- Identifier le signal CU correspondant
- Émettre un event `car:pitlane`
- Préparer la base pour TASK-19 (mode relais)

### TASK-19: Mode "Course Relais"
**Domaine**: Frontend + Backend
**Dépend de**: TASK-18
**Description**: Nouveau mode de course où le passage en pitlane inverse les pilotes.
**Action**:
- Sélection du mode au lancement de session
- À chaque détection pitlane → swap des `driver` sur le contrôleur
- UI dédiée pour visualiser les rotations

### TASK-20: 🐛 Bug — Reset session inaccessible en cours de session
**Domaine**: Frontend (principalement)
**Description**: La fonction `resetSession` **existe déjà** côté backend (`POST /api/sessions/:id/reset` → `SessionService.resetSession`) et côté front (`SessionContext.resetSession`). Mais dans l'UI championnat (`SessionSection.jsx:591`), le bouton "Reset" n'est exposé que si la session est **`finished`** (ou pendant `StartLights` via le bouton cancel).
**Conséquence**: si la session est `ready`, `active`, `paused` ou `finishing` avec une mauvaise config, **aucun bouton de reset disponible** → l'utilisateur est obligé de recréer une qualif.
**Action**:
- Exposer le bouton "Reset session" dans tous les états où ça a du sens (au minimum `ready`, `active`, `paused`, `finishing`)
- Confirmation requise quand reset depuis un état actif (modal de confirmation : *"Voitures en course, confirmer le reset ?"*)
- Vérifier que `SessionService.resetSession` gère correctement le reset depuis tous les états (pas seulement `finished`) — couper le polling, remettre la CU dans un état propre
- Tester avec un championnat : reset d'une session active doit la remettre `draft` proprement

### TASK-21: Dupliquer une session de championnat avec sa config
**Domaine**: Frontend + Backend
**Description**: Ajouter une action "Dupliquer" sur une session de championnat qui copie sa configuration (durée, tours max, pilotes, voitures, etc.).

### TASK-22: Restreindre les pilotes sélectionnables aux pilotes du championnat
**Domaine**: Frontend + Backend
**Description**: Dans la config d'un championnat, on définit la liste des pilotes participants. Dans les sessions de ce championnat, seules ces pilotes doivent apparaître dans les selects (config CU, attribution voiture, etc.).
**Action**:
- Backend : exposer la liste des pilotes du championnat (relation `ChampionshipDriver` ou équivalent à vérifier dans le schéma)
- Frontend : filtrer les `<Select>` pilote des écrans de session par les pilotes du championnat parent
- Cas du mode "hors championnat" : conserver la liste complète des pilotes

---

## ⚖️ Équilibrage (refonte)

### TASK-23: Sélection des voitures à afficher dans le graph
**Domaine**: Frontend
**Description**: Sur la page équilibrage, pouvoir cocher/décocher les voitures à afficher dans le graphique.

### TASK-24: Supprimer des temps en équilibrage (individuel + en masse par voiture)
**Domaine**: Frontend + Backend
**Description**: Sur la page équilibrage, permettre de supprimer des temps pour nettoyer les données.
**Deux cas**:
1. **Supprimer un temps individuel** : cliquer sur un tour (ex. un 5 min aberrant) pour le supprimer
   - Action UI sur le point du graph **ou** la ligne du tableau
2. **Supprimer tous les résultats d'une voiture** : bouton pour purger l'ensemble des laps d'une voiture sur la session en cours
**Action**:
- Endpoint `DELETE /api/laps/:id` pour le cas individuel
- Endpoint `DELETE /api/sessions/:id/laps?carId=...` (ou équivalent) pour la purge par voiture
- Confirmation modale dans les deux cas

### TASK-25: Séparer la page équilibrage en 2 onglets
**Domaine**: Frontend
**Description**: Refonte UX :
- Onglet **Course** : on effectue le run
- Onglet **Résultats** : visualisation des voitures sélectionnées, graph, etc.

---

## 📈 Graphiques

### TASK-26: Graphique de changement de positions (fin de course)
**Domaine**: Frontend
**Description**: À la fin de course, afficher un graphique de l'évolution des positions.
- Abscisse : tours
- Ordonnée : position
- Style : similaire au graph d'équilibrage (multi-lignes par pilote)

---

## 🔧 Technique / Architecture

### TASK-27: 🐛 Fiabiliser la communication CU
**Domaine**: Backend
**Description**: Parfois les sessions ne se lancent pas correctement OU ne se finissent pas correctement. La CU n'est pas dans l'état/mode voulu.
**Action**:
- Audit du flow start/stop session côté CU
- Ajouter des retries + vérification d'état après chaque commande
- Logger les transitions d'état CU

### TASK-28: 🔍 Étude — Intégrer carreralib (Python) ?
**Domaine**: Architecture
**Description**: Évaluer la pertinence d'intégrer la lib **carreralib** (Python) pour remplacer/compléter notre système de communication CU.
**Questions**:
- Faut-il recoder tout le système de communication ?
- Revoir le fonctionnement de l'app et du polling ?
- Quel coût d'intégration (bridge Python/Node) ?
**Livrable**: doc d'étude + recommandation.

### TASK-29: Réordonner et unifier les logs de l'app
**Domaine**: Frontend + Backend
**Description**: Il y a plusieurs façons de voir les logs dans l'app aujourd'hui → audit + unification.
**Action**:
- Lister tous les endroits où on log
- Définir un système unique (console UI, fichier, etc.)
- Réordonner par pertinence

### TASK-30: Revoir le système d'update de l'app
**Domaine**: Backend + Build
**Statut**: ✅ Fiabilisé en v1.13.0 → v1.15.0 — la question de fond reste ouverte
**Description**: Le système d'update actuel doit être repensé.
**Fait**:
- Détection de version sémantique : une version plus ancienne n'est plus annoncée comme une mise à jour (v1.13.0)
- Sauvegarde datée de la base avant toute mise à jour, migration ou installation (v1.13.0)
- `startup.js` sauvegarde avant migration et s'interrompt si `db push` échoue, au lieu de démarrer sur un schéma désynchronisé (v1.13.0)
- Retour arrière automatique si l'installation des dépendances ou le build échoue (v1.14.0)
- La migration de schéma, seule étape irréversible, passe en dernier (v1.14.0)
- Les lanceurs Windows/macOS refusent de démarrer sur une installation cassée : erreur affichée et choix réparer / réessayer / fermer (v1.15.0)
- `npm run repair` rejoue une mise à jour hors de l'app, quand celle-ci ne démarre pas (v1.15.0)
**Reste à décider**:
- Le besoin de fond : auto-update, manuel, OTA ?
- Vérifier après le pull que la version obtenue est bien celle annoncée
- Le lanceur Windows n'a pas pu être testé sur Windows (développement sous macOS) : à valider au premier lancement sur le PC de course

### TASK-31: Utiliser des clés de traduction (i18n) partout
**Domaine**: Frontend
**Description**: Remplacer tous les textes en dur de l'UI par des **clés de traduction** i18n, en préparation de la traduction EN/FR de l'app.
**Action**:
- Mettre en place (ou compléter) le système i18n + fichiers de traduction `en` / `fr`
- Audit : repérer tous les libellés/textes hardcodés dans les composants
- Remplacer par des clés de traduction
- Sélecteur de langue dans les paramètres
**Note**: transverse — à coordonner avec TASK-03 et TASK-04 qui mentionnent déjà des libellés i18n par enum.

### TASK-32: 🔍 Étude — `ControllerConfig` répond-il encore à un besoin ?
**Domaine**: Backend + Frontend
**Description**: Le modèle `ControllerConfig` est un préréglage **par circuit** (« sur ce circuit, la manette 1 = tel pilote avec telle voiture »), alors que l'attribution des manettes change à chaque session. L'audit montre qu'il n'est en pratique jamais alimenté : à clarifier avant de le faire suivre les suppressions en cascade.
**Constats (audit du 27/08/2026)**:
- **La table est vide** : 0 ligne, pour 126 sessions et 12 227 tours enregistrés
- **Aucun écran du frontend n'appelle `/api/config`** — les routes existent (`GET/PUT /api/config`, `/bulk`, `/validate`, `/:controller`) mais ne sont utilisées par personne
- La configuration réelle d'une session passe par `PUT /api/sessions/:id/drivers`, qui écrit directement des `SessionDriver`
- `SessionService.createSession()` lit pourtant `controllerConfig` pour pré-remplir les `SessionDriver` : cette boucle ne produit donc jamais rien
- `@@unique([trackId, controller])` : une seule attribution par circuit, écrasée à chaque modification — deux sessions du même circuit ne peuvent pas avoir d'attributions différentes
- Aucun lien vers `Session` ; le champ `isActive` est écrit une fois et jamais lu
- Pas de `deletedAt` : la table ne peut pas suivre les suppressions douces
- Les réglages vitesse / frein / carburant ne sont **pas** ici : ils sont portés par `Car` (`maxSpeed`, `brakeForce`, `fuelCapacity`)
**Questions à trancher**:
- Le préréglage par circuit correspond-il à un usage réel en course, ou faut-il le supprimer purement et simplement (modèle, service, routes) ?
- Si on le garde : doit-il devenir un préréglage par championnat, ou rester par circuit ?
- Faut-il alors un `deletedAt` pour qu'il suive la suppression d'un circuit (cf. TASK-33) ?
- Le pré-remplissage des pilotes à la création d'une session est-il un besoin réel ? Si oui, il faut l'alimenter depuis un flux réellement utilisé
**Lié à**: TASK-33 (cascades), RUSH-04 (puissance de toutes les voitures au lancement)

### TASK-33: Passer entièrement aux migrations Prisma (et baseline du PC de course)
**Domaine**: Backend + Déploiement
**Priorité**: Haute — bloque tout changement de schéma sûr
**Description**: Le schéma est aujourd'hui mis à jour par `prisma db push --accept-data-loss`, lancé par `startup.js` au changement de version. Cela fonctionne pour un ajout de colonne, mais **détruit les données sans prévenir** dès qu'un changement implique un renommage, une suppression de colonne ou un changement de type. Il faut passer à `prisma migrate deploy`.
**Constats (audit du 28/08/2026)**:
- Les migrations étaient bien versionnées, mais `.gitignore` contenait `prisma/migrations/`, ce qui empêchait d'en **ajouter de nouvelles** : l'historique s'arrêtait au 5 avril 2026, soit 11 opérations de retard sur le schéma réel
- La ligne du `.gitignore` a été retirée et la migration `20260828_catchup_schema_actuel` comble l'écart (l'historique décrit désormais le schéma exact)
- Le poste de développement a été baseliné : 5 migrations enregistrées, `migrate status` → « up to date », `migrate deploy` → no-op
- **La base du PC de course n'est pas baselinée** : son `_prisma_migrations` est inconnu, probablement limité à `20260117150753_init` comme l'était celle du poste de dev
**⚠️ Ordre impératif**:
1. **D'abord** baseliner la base de Romain — sinon `migrate deploy` tentera de rejouer `add_preferences` et les suivantes sur des tables existantes. L'échec bloquerait le démarrage, puisque `startup.js` s'interrompt désormais en cas d'erreur de migration
2. **Ensuite seulement** remplacer `db push` par `migrate deploy` dans `scripts/startup.js`, `src/routes/update.js`, `RaceHubOS-install-win.bat` et `RaceHubOS-install-mac.command`
**Procédure de baseline chez Romain** (identique à celle appliquée en local le 28/08/2026).
Tout se lance depuis `C:\Users\Romain\RaceHubOS\packages\backend`. En PowerShell, enchaîner avec `;` et non `&&`.

1. **Arrêter l'application** (fermer la fenêtre RaceHubOS) pour qu'aucune écriture ne soit en cours.
2. **Récupérer le code** contenant les migrations versionnées : `git pull origin main` à la racine du projet.
3. **Sauvegarder la base** : `node scripts/backup-db.js avant-baseline` — la copie atterrit dans `prisma/db-old/`.
4. **Lister ce que la base déclare déjà appliqué** :
   `npx prisma migrate status`
   Noter les migrations signalées comme non appliquées ; c'est la liste à traiter à l'étape 6.
5. **Vérifier qu'il n'y a pas d'écart de schéma réel** :
   `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`
   - Sortie vide ou « This is an empty migration » → la base est conforme, passer à l'étape 6.
   - Sortie non vide → **ne pas marquer les migrations**. Le schéma de Romain diffère du nôtre : lire le SQL produit, l'appliquer manuellement à la main (`sqlite3 prisma/dev.db` ou via un `db push` ponctuel après sauvegarde), puis refaire cette étape jusqu'à obtenir une sortie vide.
6. **Marquer comme appliquée chaque migration manquante**, une par une :
   `npx prisma migrate resolve --applied 20260327_add_preferences`
   `npx prisma migrate resolve --applied 20260327_add_soft_delete`
   `npx prisma migrate resolve --applied 20260405_remove_ready_status`
   `npx prisma migrate resolve --applied 20260828_catchup_schema_actuel`
   (adapter à la liste réellement manquante relevée à l'étape 4 ; `20260117150753_init` est normalement déjà enregistrée)
7. **Contrôler le résultat** :
   `npx prisma migrate status` → doit afficher « Database schema is up to date! »
   `npx prisma migrate deploy` → doit répondre « No pending migrations to apply. »
8. **Vérifier les données** avant de relancer l'app : nombre de pilotes, de sessions et de tours identiques à l'avant-baseline, et `PRAGMA integrity_check;` à `ok`.
9. **Rejouer les cascades de suppression** — voir la section ci-dessous.
10. **Redémarrer RaceHubOS** et confirmer que l'application se lance normalement.

En cas de problème à n'importe quelle étape : restaurer la sauvegarde de l'étape 3 depuis `prisma/db-old/` — le baseline ne touche qu'à la table `_prisma_migrations`, jamais aux données.

**Rattrapage des cascades de suppression** (à faire une seule fois, sur chaque base existante)

Les cascades n'existent que depuis la v1.18.0 : tout ce qui a été supprimé avant n'a marqué que l'objet lui-même. Sur le poste de développement, cela représentait **8 146 tours toujours visibles dans les statistiques** alors que leur circuit était supprimé depuis juillet. La base de Romain a le même historique, donc le même écart.

- Simuler d'abord, la commande ne modifie rien :
  `node scripts/replay-cascades.js`
  Elle liste, entité par entité, ce qui serait masqué.
- Appliquer ensuite :
  `node scripts/replay-cascades.js --apply`
  Une sauvegarde datée est créée automatiquement dans `prisma/db-old/` avant toute écriture.
- Contrôler que plus rien ne subsiste :
  `sqlite3 prisma/dev.db "SELECT COUNT(*) FROM Lap l JOIN Track t ON t.id=l.trackId WHERE l.deletedAt IS NULL AND t.deletedAt IS NOT NULL;"` → doit renvoyer 0

**À prévenir Romain** : les statistiques vont perdre d'un coup une grande partie de leurs temps — sur le poste de dev, 12 036 tours actifs sont tombés à 3 847. Rien n'est effacé : chaque ligne est marquée avec l'horodatage de suppression de son parent, donc restaurer un circuit ramène exactement ses tours. Si le résultat ne convient pas, la sauvegarde de `prisma/db-old/` permet de revenir en arrière.
**Ensuite, en développement**: tout changement de schéma passe par `prisma migrate dev` (fichier de migration à commiter), plus jamais par `db push`
**Lié à**: TASK-30 (système de mise à jour), TASK-32 (`ControllerConfig`)

---

## 🏎️ Demandes Rush — ordre de traitement

> Backlog ordonné à traiter point par point. Chaque tâche doit être analysée, implémentée puis validée avant de passer à la suivante.

### RUSH-01: 🐛 Empêcher tout tour supplémentaire pour un pilote ayant terminé
**Domaine**: Backend + communication CU
**Priorité**: Haute
**Statut**: ✅ Fait en v1.12.1 (commit `c359b75`) — reste à valider en course réelle avec la CU
**Description**: Dès qu'un pilote remplit sa condition de fin de course, il ne doit plus pouvoir enregistrer de tour supplémentaire, même si les autres pilotes sont encore dans la période de grâce.
**À vérifier**:
- Identifier comment l'état `finished` est suivi pour chaque pilote/contrôleur
- Ignorer tout nouveau passage de ligne pour un pilote déjà terminé
- Vérifier si la puissance de sa voiture est déjà coupée individuellement et fiabiliser cette commande si nécessaire
- Tester les courses au nombre de tours et les courses au temps
- Tester plusieurs passages pendant la période de grâce
**Décision**: ne pas considérer la réduction de la période de grâce à 15 secondes comme le correctif principal. La période de grâce doit laisser finir les autres pilotes sans autoriser de nouveaux tours aux pilotes déjà classés.
**Lié à**: TASK-12, TASK-13 et TASK-17

### RUSH-02: Ajouter un pilote de référence à l'équilibrage
**Domaine**: Frontend + Backend
**Statut**: ✅ Fait en v1.16.0
**Description**: Permettre de sélectionner un pilote de référence pour effectuer les runs d'équilibrage.
**Décisions prises**:
- Le pilote se choisit dans les **Paramètres**, parmi les pilotes existants ; un bouton crée « Le STIG » au besoin
- Ni obligatoire ni créé automatiquement : sans lui, la page Équilibrage affiche un avertissement et un raccourci vers les paramètres
- Tous les tours d'équilibrage lui sont attribués (`Driver.isReference`), y compris rétroactivement via le bouton de réattribution
- Les tours d'équilibrage étaient jusqu'ici enregistrés **sans pilote** (`driverId` NULL) : ils ne polluaient donc pas les statistiques des autres pilotes
- Le filtre « Équilibrage » a été ajouté à la page Statistiques

### RUSH-03: Séparer les statistiques par circuit et afficher la session d'origine
**Domaine**: Frontend + Backend
**Description**: Ajouter en haut de la page Statistiques un sélecteur de circuit afin de ne jamais mélanger les temps de différents tracés.
**Action**:
- Filtrer toutes les statistiques par `trackId`
- Définir le circuit sélectionné par défaut et gérer l'absence de circuit
- Remplacer la colonne « Circuit » par la session dans laquelle le temps a été réalisé
- Afficher **Course libre**, **Équilibrage** ou le nom du **Championnat** selon l'origine du temps
- Vérifier le comportement des anciens tours et des circuits supprimés
**Critère d'acceptation**: aucun temps d'un autre circuit ne doit apparaître après la sélection d'un circuit.
**Lié à**: TASK-02, TASK-03, TASK-05 et TASK-08

### RUSH-04: Régler la puissance de toutes les voitures au lancement d'une course
**Domaine**: Frontend + Backend
**Description**: Lors de la préparation d'une course, permettre de choisir une puissance commune et de l'appliquer à toutes les voitures en une seule action, sans ouvrir les paramètres de chaque voiture.
**Action**:
- Ajouter un contrôle global de puissance dans l'écran de lancement
- Appliquer la valeur à toutes les voitures sélectionnées tout en permettant, si utile, des ajustements individuels
- Enregistrer la puissance réellement utilisée avec la session ou les résultats
- Afficher la puissance des voitures dans les statistiques

### RUSH-05: 🐛 Vérifier la correspondance entre puissance en pourcentage et valeur CU
**Domaine**: Backend + communication CU
**Priorité**: Haute
**Description**: Vérifier que **70 %** dans l'application envoie réellement la valeur **7** attendue par la Carrera Control Unit et produit la puissance correspondante.
**Action**:
- Tracer la valeur UI, la conversion, la commande envoyée et la valeur confirmée par la CU
- Vérifier les arrondis et les bornes de l'échelle
- Tester au minimum 0 %, 10 %, 50 %, 70 % et 100 %
- Corriger la conversion ou le libellé si l'échelle réelle n'est pas linéaire
**Critère d'acceptation**: le mapping affiché est documenté et vérifié sur la base réelle.

### RUSH-06: Concevoir le mode « Relais »
**Domaine**: Produit + Frontend + Backend + communication CU
**Description**: Commencer par définir précisément le fonctionnement d'une course en relais avant son implémentation.
**Questions à trancher**:
- Composition et taille des équipes
- Durée ou nombre de tours par relais
- Déclenchement manuel ou détection automatique du passage aux stands
- Attribution pilote/voiture pendant les changements
- Pénalités, fenêtre de relais et durée minimale d'arrêt
- Classement, statistiques et affichage en direct
**Premier livrable**: spécification fonctionnelle et proposition de parcours UI.
**Lié à**: TASK-18 et TASK-19

### RUSH-07: Assigner une voiture principale à chaque pilote
**Domaine**: Frontend + Backend
**Description**: Ajouter une voiture principale au profil du pilote et la présélectionner automatiquement dès que ce pilote est choisi.
**Action**:
- Ajouter une relation optionnelle `defaultCarId` sur le pilote
- Permettre son choix dans le profil du pilote
- Présélectionner cette voiture dans les écrans de configuration de course et de championnat
- Laisser l'utilisateur remplacer cette présélection pour une session donnée
**Décision proposée**: stocker la voiture principale dans le profil pilote, car cette préférence dépasse le cadre d'un championnat.

### RUSH-08: Créer des badges pour les pilotes et les voitures
**Domaine**: Frontend + Backend
**Description**: Permettre d'attribuer des badges aux pilotes et aux voitures, puis de les afficher dans les statistiques.
**Action**:
- Définir les données d'un badge : nom, description et logo
- Autoriser une petite image dédiée, distincte des grandes images de pilote et de voiture
- Définir les critères d'attribution manuels ou automatiques
- Afficher les badges dans les profils et les statistiques sans surcharger les tableaux

### RUSH-09: Autoriser les qualifications avec un seul pilote
**Domaine**: Frontend + Backend
**Description**: Dans la création d'un championnat, autoriser une session de qualification avec **1 pilote minimum** afin d'organiser des qualifications solo pendant un nombre défini de tours.
**Action**:
- Faire passer la validation minimale de 2 à 1 pilote pour les qualifications
- Vérifier la rotation des pilotes et la fin de session en mode solo
- Tester les qualifications limitées au temps et au nombre de tours

### RUSH-10: Renommer les qualifications et les courses
**Domaine**: Frontend + Backend
**Description**: Dans la création et l'édition d'un championnat, permettre de modifier directement le nom de chaque qualification et de chaque course.
**Action**:
- Ajouter un champ de nom par session
- Proposer un nom par défaut, mais le rendre modifiable immédiatement
- Réutiliser ce nom dans le planning, l'écran de course, l'historique et les statistiques

### RUSH-11: Ajouter plusieurs sessions d'essais libres chronométrées aux championnats
**Domaine**: Frontend + Backend
**Description**: Permettre de créer plusieurs sessions d'essais libres avec une durée définie dans un championnat. Elles servent à garantir le même temps d'entraînement à tous les pilotes, sans compter au classement.
**Action**:
- Ajouter le type « Essais libres » dans le constructeur de championnat
- Autoriser plusieurs sessions et leur réorganisation
- Configurer leur durée et les pilotes concernés
- Exclure explicitement leurs résultats du classement du championnat
- Conserver leurs tours dans les statistiques du circuit avec l'origine « Essais libres — nom du championnat »

### RUSH-12: Choisir les pilotes autorisés lors de la création d'un championnat
**Domaine**: Frontend + Backend
**Description**: À la création ou à l'édition d'un championnat, sélectionner la liste des pilotes participants. Seuls ces pilotes doivent ensuite être proposés dans les sessions de ce championnat.
**Action**:
- Ajouter un sélecteur multiple de pilotes dans le formulaire du championnat
- Persister la liste des participants
- Filtrer tous les sélecteurs de pilote des qualifications, essais et courses
- Gérer proprement l'ajout ou le retrait d'un participant après la création
**Lié à**: TASK-22
