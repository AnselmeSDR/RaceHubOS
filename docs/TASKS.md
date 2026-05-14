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
**Description**: Ajouter une colonne dans le tableau des statistiques indiquant le championnat dans lequel le temps a été réalisé.
**Action**:
- Backend : joindre `championship` dans la requête stats
- Frontend : ajouter la colonne dans le tableau + filtre

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
**Description**: Le système d'update actuel doit être repensé.
**Action**:
- Définir le besoin (auto-update, manuel, OTA ?)
- Proposer un nouveau flow

### TASK-31: Utiliser des clés de traduction (i18n) partout
**Domaine**: Frontend
**Description**: Remplacer tous les textes en dur de l'UI par des **clés de traduction** i18n, en préparation de la traduction EN/FR de l'app.
**Action**:
- Mettre en place (ou compléter) le système i18n + fichiers de traduction `en` / `fr`
- Audit : repérer tous les libellés/textes hardcodés dans les composants
- Remplacer par des clés de traduction
- Sélecteur de langue dans les paramètres
**Note**: transverse — à coordonner avec TASK-03 et TASK-04 qui mentionnent déjà des libellés i18n par enum.
