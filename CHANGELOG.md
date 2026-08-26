# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.17.0] - 2026-08-26

### Added
- **Colonne « Championnat » dans les statistiques** (TASK-02) : chaque temps indique le championnat dans lequel il a été réalisé, ou « — » lorsqu'il vient d'une course libre, d'essais ou d'un équilibrage
  - Colonne triable et cliquable, qui ouvre la fiche du championnat
  - Placée entre « Circuit » et « Session »
  - **Filtre par championnat**, avec une option « Hors championnat » pour isoler les courses libres, essais et équilibrages ; plusieurs championnats peuvent être combinés

### Fixed
- **Menus de filtre et listes déroulantes transparents au défilement** : leur fond était translucide, l'opacité venant d'un effet de flou porté par un calque interne — qui défilait avec le contenu et disparaissait dès qu'on faisait défiler la liste, laissant voir la page au travers. Le fond est désormais opaque
- **Listes déroulantes qui se repositionnaient pendant le défilement** (constaté sur le PC de course) : les options se décalaient et empêchaient de choisir une valeur située plus bas. Les listes sont maintenant ancrées au champ (`position="popper"`) au lieu d'être alignées sur l'option sélectionnée
- **Ordre des colonnes après l'ajout d'une nouvelle colonne** : l'ordre mémorisé d'une liste ne connaît pas les colonnes ajoutées ensuite, qui se retrouvaient reléguées en fin de tableau — hors écran. Elles sont désormais réinsérées à la position où elles sont définies, sans perdre l'ordre choisi par l'utilisateur

## [1.16.0] - 2026-08-26

### Added
- **Pilote de référence pour l'équilibrage** (RUSH-02) : l'équilibrage mesure les voitures, pas les pilotes — tous ses tours reviennent désormais à un pilote unique, quel que soit celui qui tient la manette
  - **Paramètres** : sélection du pilote de référence, bouton **Créer Le STIG** (sans doublon si le pilote existe déjà) et bouton pour réattribuer les tours d'équilibrage déjà enregistrés
  - **Page Équilibrage** : avertissement et raccourci vers les paramètres tant qu'aucun pilote de référence n'est défini
  - Les sessions d'équilibrage attribuent automatiquement leurs tours au pilote de référence ; les courses, qualifications et essais gardent leur pilote réel
  - Nouveau champ `Driver.isReference` — un seul pilote de référence à la fois, modifiable comme n'importe quel pilote (le renommer ne casse rien)
- **Filtre « Équilibrage » dans les statistiques** : les tours d'équilibrage étaient déjà enregistrés avec ce type mais restaient absents du filtre

## [1.15.0] - 2026-08-26

### Added
- **L'application ne démarre plus sur une installation cassée** : si le démarrage échoue, les lanceurs Windows et macOS affichent l'erreur et proposent trois choix — relancer la mise à jour (réparation), réessayer de démarrer, ou fermer
  - Auparavant la fenêtre se refermait sans message : impossible de savoir ce qui s'était passé
  - Le navigateur ne s'ouvre que si l'application répond réellement
  - Un échec de migration est distingué des autres erreurs (code de sortie 43) et indique que la base n'a pas été modifiée, avec l'emplacement de la sauvegarde
- **`npm run repair`** : rejoue une mise à jour hors de l'application (récupération, dépendances, build, sauvegarde, migration) — utilisable quand l'app ne démarre pas et ne peut donc pas proposer sa propre mise à jour

### Changed
- **`startup.js`** sort avec le code 43 quand la migration échoue, au lieu d'une erreur non qualifiée, pour que le lanceur puisse expliquer précisément le problème

## [1.14.0] - 2026-08-26

### Added
- **Retour arrière automatique en cas de mise à jour ratée** : si `npm install` ou le build du frontend échoue après le `git pull`, l'application revient au commit précédent, réinstalle ses dépendances et reconstruit le frontend
  - Auparavant, un réseau coupé ou une dépendance qui ne compile pas laissait l'installation à moitié faite : au redémarrage suivant, l'app ne fonctionnait plus
  - Si la restauration elle-même échoue, le message l'indique explicitement au lieu de rester silencieux
  - Couvert par des tests d'intégration sur un vrai dépôt git

### Changed
- **La migration de schéma passe en dernier** dans la mise à jour, après l'installation et le build : c'est la seule étape irréversible, elle n'est donc tentée qu'une fois le code en place. En cas d'échec, `startup.js` la rejoue au redémarrage

## [1.13.0] - 2026-08-26

### Added
- **Sauvegarde datée avant chaque mise à jour** : la base est copiée dans `packages/backend/prisma/db-old/` sous la forme `AAAA-MM-JJ_HH-MM-SS_<raison>.db`, avec rotation automatique (10 dernières conservées)
  - Déclenchée par la mise à jour depuis l'application (`update`), par la migration de schéma au démarrage (`schema-push`) et par les installeurs Windows/macOS (`install`)
  - Copie réalisée via `VACUUM INTO` : cohérente même si le serveur tourne, et sans fichiers `-wal`/`-shm` associés
  - Sauvegarde manuelle possible : `node scripts/backup-db.js <raison>`
  - Remplace l'unique `dev.db.backup` qui était écrasé à chaque mise à jour — il n'y avait donc jamais d'historique

### Changed
- **Prisma 6 → 7** : nouvel adaptateur SQLite officiel (`@prisma/adapter-better-sqlite3`), configuration déportée dans `prisma.config.js`, et instanciation centralisée via `createPrismaClient()` (`src/lib/prisma.js`) — plus aucun `new PrismaClient()` dispersé dans les routes et services
  - `src/lib/database-url.js` conserve le comportement Prisma 6 : un `DATABASE_URL` relatif (`file:./dev.db`) reste résolu depuis le dossier `prisma/`
  - Dates stockées en `unixepoch-ms`, comme avant la migration
- **Outillage frontend** : Vite 7 → 8, `@vitejs/plugin-react` 5 → 6, ESLint 9 → 10, `@tailwindcss/vite` 4.2 → 4.3
- **Bibliothèques** : framer-motion 12 → 13, react-easy-crop 5 → 6, ink 6 → 7, plus les mises à jour compatibles (i18next, react-i18next, lucide-react, shadcn, globals, React 19.2.3)
- **Node.js 22+ requis** (au lieu de 20+) : imposé par Vite 8 et ESLint 10 — les installeurs Windows et macOS/Linux vérifient et installent la bonne version
- **`package-lock.json` désormais versionné** : les installations sur le PC de course sont reproductibles à l'identique

### Fixed
- **Détection de mise à jour** : la comparaison avec GitHub était une simple inégalité de chaînes (`latestVersion !== currentVersion`), donc une version **plus ancienne** était annoncée comme « nouvelle version disponible » — et une mise à jour lancée depuis ce bandeau aurait fait un retour arrière avec `db push` sur un schéma antérieur. La comparaison est désormais sémantique (`src/lib/version.js`, couverte par des tests)
- **Les tests effaçaient la base réelle** : `npm test` s'exécutait sur `dev.db` (via le `DATABASE_URL` du `.env`) alors que `setup.js` vide toutes les tables — un simple lancement des tests détruisait pilotes, voitures, sessions et tours
  - Les tests utilisent désormais une base jetable `prisma/test.db`, **créée au lancement** à partir de `schema.prisma` (`prisma migrate diff`) et supprimée à la fin
  - `setup.js` refuse de démarrer si `DATABASE_URL` ne pointe pas sur une base de test
- **`startup.js`** : la base est sauvegardée avant la migration ; si `prisma db push` échoue, la version n'est plus marquée comme migrée et le démarrage s'interrompt avec un message explicite — auparavant l'application démarrait sur un schéma désynchronisé sans jamais réessayer
  - `--skip-generate` retiré : l'option n'existe plus dans Prisma 7

## [1.12.1] - 2026-08-26

### Added
- **Tests de fin de session** : couverture des limites en tours et au temps pour les essais libres, qualifications, courses et sessions d'équilibrage
- **Backlog Rush** : ajout des 12 prochaines évolutions produit dans `docs/TASKS.md`

### Fixed
- **Tours supplémentaires après l'arrivée** : les passages d'un pilote ayant déjà terminé sont ignorés pendant la période de grâce, sans modifier ses tours, ses temps ou son classement
- **Événements CU tardifs** : les passages reçus lorsqu'aucune session n'est active sont désormais ignorés

## [1.12.0] - 2026-05-16

### Added
- **Traduction i18n EN/FR** : toute l'app est désormais traduisible, basée sur `react-i18next`
  - Infrastructure : `import.meta.glob` auto-détecte les fichiers de traduction, fallback FR, détection navigateur, persistance localStorage
  - Sélecteur de langue dans **Paramètres**
  - Namespaces : `common`, `glossary` (termes métier + statuts + types de session), `layout`, `settings`, `dashboard`, `drivers`, `cars`, `tracks`, `teams`, `sessions`, `stats`, `championships`, `race`, `balancing`, `freeSession`, `displays`, `test`
  - Pluriels gérés par i18next (`_one` / `_other`) — paramètre `count` automatique
  - Dates locale-aware (`toLocaleDateString(i18n.language)`)
  - Toutes les pages migrées (Settings, Layout, Dashboard, Drivers, Cars, Tracks, Teams, Sessions, Stats, Championships + tous les profils détail + Mode Libre, Équilibrage, Displays, Test) ainsi que tous les composants race/championship/balancing/crud/ui
- **`ChampionshipBracket`** : pour les courses terminées, affichage de la **position finale** (P1/P2/P3 en jaune pour le podium) et du **temps total** par pilote, en plus de la position de grille

### Changed
- **Couleurs de type de session centralisées** dans `lib/colors.js` (helper `sessionBadgeClass()`) et basées sur les variables du thème (`bg-session-practice`, `bg-session-race`, etc.) — plus de duplication des classes Tailwind dans 6 fichiers
- **`StandingsTabs`** utilise désormais `glossary:sessionType` / `glossary:sessionTypeFull` au lieu de ses propres clés dupliquées
- **`SessionSection`** : hauteur uniforme `h-8` sur Select/Input + gap horizontal sur les cellules du tableau de config

### Fixed
- **`DriverProfile`, `CarProfile`, `TrackProfile`, `SessionDetail`** : remplacement du `confirm()` natif par `ConfirmModal` pour le reset stats / suppression
- **`SessionDetail`** : code mort nettoyé (`getImgUrl`, `formatDuration`, `totalPauseDuration`, `totalLaps`, `fastestDriver` — scaffolding jamais branché)
- **`Dashboard`** : alignement vertical correct des valeurs des cartes stats (icône + label dans une div, valeur dans l'autre, `justify-between`)
- **`Dashboard` "Records absolus"** : chaque record dans sa propre carte bordée → la valeur d'un item n'est plus collée au label du suivant

## [1.11.0] - 2026-05-13

### Added
- **Auto-application des profils voiture** : au démarrage de chaque session, les valeurs `maxSpeed`/`brakeForce`/`fuelCapacity` du profil de chaque voiture sont appliquées sur la CU (mapping 0-100 → CU 1-10 pour speed/brake, 1-15 pour fuel)
- **Slots sans pilote** : les 6 slots de la CU reçoivent les défauts usine (speed=10, brake=10, fuel=7) si aucun pilote n'est assigné
- **Auto-throttle de fin** : un pilote ayant terminé sa condition (laps atteints OU lap complété pendant grace period) voit sa vitesse passée à 1, les autres pilotes continuent
- **Doc technique CU** : `docs/CU-CARRERA-PROTOCOL.md` — référence complète du protocole BLE, états, boutons, modes, fuel system
- **Notice CU** : `docs/Carrera-30352-Control-Unit-Manual.pdf` ajoutée au repo

### Fixed
- **Podium voix : annonce de positions inexistantes** : avec 1 ou 2 pilotes, la voix annonçait "troisième" / "deuxième" pour des pilotes qui n'existaient pas. Les labels et drivers sont maintenant couplés avant le reverse
- **finishSession appelée plusieurs fois** : guard `_finishing` ajouté pour éviter que la grace period timer + heartbeat + check déclenchent simultanément finishSession (causait des oscillations de vitesse)
- **applyCarConfigs ordre** : déplacée APRÈS `prepareRace()` au start de session pour ne pas perturber la séquence de mise en L1

## [1.10.0] - 2026-05-12

### Added
- **Auto-throttle de fin de course** : la vitesse d'un pilote ayant rempli sa condition de fin (laps ou temps) est automatiquement baissée à 1, les autres pilotes continuent à pleine vitesse. Restauration à 15 en fin de session
- **`pressButton` / `pressEsc` / `stopCars`** : nouvelles méthodes sur `ControlUnit` (manquaient — les commandes n'arrivaient pas à la CU)
- **Log scan BLE amélioré** : affichage du nom des peripherals découverts en plus de l'adresse

### Fixed
- **Commandes CU bloquées par le polling** : refonte du `request()` avec mutex async pour sérialiser proprement les commandes BLE. Avant, le polling continu (`?`) monopolisait le canal et les commandes (`T`, `J`, `=`) ne partaient jamais
- **Protocole BLE : retrait du `$` terminal** : le `$` est uniquement pour le protocole série, pas BLE (alignement avec `carreralib`)
- **Footer déconnecté alors que CU active** : le backend n'émettait pas `cu:connected` à la connexion socket initiale, et le frontend ne déduisait pas `connected` depuis l'event `cu:status`
- **Graceful shutdown** : `httpServer.close()` est maintenant attendu avant `process.exit`, évitant les `EADDRINUSE` au restart en mode `--watch`

## [1.9.10] - 2026-04-18

### Added
- **Auto-connexion CU** : connexion automatique à la dernière Control Unit au démarrage (toggle dans Settings)
- **Reconnexion BLE** : retry récursif avec compteur, reset des états à la déconnexion

### Changed
- **ControlUnit** : stockage de l'adresse à la connexion

## [1.9.9] - 2026-04-15

### Changed
- **Équilibrage : refonte métriques** : 3 colonnes dans les cards et le panel droit — Best lap (violet), Best médiane fenêtre 5 (highlight jaune + écart), Moyenne 60% meilleurs tours
- **Équilibrage : cards triées** par best médiane fenêtre 5 (plus rapide en premier)
- **Équilibrage : médianes par fenêtre de 5** : fenêtres indépendantes (1-5, 6-10, 10-15...) au lieu de paliers cumulatifs
- **Équilibrage : médiane → tous les tours** : la médiane affichée dans le panel droit est celle de tous les tours cumulés
- **Équilibrage : 60% = moyenne** : la métrique 60% est maintenant la moyenne (et non médiane) des 60% meilleurs tours

### Fixed
- **Prisma warning** : suppression du bloc `prisma.seed` déprécié dans package.json

## [1.9.7] - 2026-04-15

### Fixed
- **Mise à jour Windows EPERM** : suppression du `postinstall` prisma generate du root package.json (causait EPERM sur Windows car la DLL est verrouillée). Prisma generate est maintenant géré par `startup.js` au démarrage et par le script `dev` en développement

## [1.9.6] - 2026-04-15

### Fixed
- **Mise à jour : "connexion perdue"** : lors d'une déconnexion WebSocket pendant la mise à jour, le frontend affiche "Redémarrage du serveur..." et attend le retour du serveur au lieu d'afficher une erreur
- **Ouverture navigateur Windows** : le `.bat` attend que le serveur soit prêt (polling `/health`) avant d'ouvrir le navigateur, au lieu d'un timeout fixe de 3s
- **Mise à jour du lanceur** : le `.bat` est automatiquement régénéré depuis le template lors d'une mise à jour via l'interface

## [1.9.4] - 2026-04-15

### Fixed
- **Équilibrage : crash saveLap** : `driverId` rendu optionnel dans le schema Lap (était requis, causait un crash Prisma en mode équilibrage sans pilote)
- **Mise à jour Windows** : correction EPERM lors du `npm install` (DLL Prisma verrouillée par le process en cours). Le postinstall Prisma est désormais ignoré pendant la mise à jour, et `prisma generate + db push` s'exécutent au redémarrage du serveur

## [1.9.2] - 2026-04-15

### Fixed
- **Équilibrage : config incomplète** : en mode équilibrage, assigner une voiture sans pilote ne bloque plus le démarrage (seules les voitures sont requises)

## [1.9.1] - 2026-04-15

### Fixed
- **Prisma generate automatique** : ajout d'un script `postinstall` pour lancer `prisma generate` après `npm install` (corrige l'erreur sur les nouvelles installations)

## [1.9.0] - 2026-04-12

### Added
- **Championnats automatiques** : nouveau mode "Auto" pour les championnats avec génération automatique de l'arbre qualifications/courses
- **Wizard de création** : assistant multi-étapes (infos, pilotes, configuration qualif/course, aperçu) avec switch Manuel/Auto
- **Sélection des participants** : liste de pilotes avec ajout dynamique (nouvelle ligne automatique), modifiable à tout moment
- **Génération automatique des sessions** : répartition équilibrée des pilotes en groupes de qualif (round-robin) et courses (séquentiel)
- **Auto-progression** : après toutes les qualifications, les pilotes sont automatiquement assignés aux courses selon le classement fusionné (meilleur tour)
- **Bracket/Arbre** : visualisation 3 colonnes (qualifs → classement global → courses) avec mise à jour temps réel
- **Édition flexible** : ajout de pilotes, qualifs ou courses supplémentaires même après le début du championnat (sessions terminées immutables)
- **Couleurs sémantiques** : tokens CSS dans `@theme` (`session-practice`, `gap-laps`, `leader`, `ctrl-1`...) pour cohérence des couleurs

### Changed
- **Classement général courses** : colonnes Tours + Écart/Total, gap en tours (orange) quand le nombre de tours diffère du leader
- **Leaderboard course** : le leader affiche "Leader" en violet pendant la course, le temps total uniquement à la fin
- **Config championnat** : sessions éditables/supprimables si en draft (même en mode auto), sessions terminées verrouillées
- **Traduction statuts** : `finished` → `Terminé`, `active` → `En cours`, etc. dans le panneau de configuration

## [1.8.0] - 2026-04-11

### Added
- **Sessions d'équilibrage** : nouveau type de session `balancing` dédié à l'équilibrage des voitures
- **Page Équilibrage** (`/balancing`) : page dédiée avec sélecteur de circuit, config simplifiée (contrôleur + voiture uniquement)
- **Graphe temps au tour** : LineChart recharts en temps réel remplaçant le leaderboard, une courbe par voiture
- **Statistiques par voiture** : meilleur tour, meilleure médiane (par tranche de 5 tours), indicateur de tendance (accélère/ralentit/stable)
- **Écart entre voitures** : delta de meilleure médiane affiché pour comparer les performances
- **Classement général par voiture** : best lap + meilleure médiane par voiture (pas par pilote) dans le panneau droit
- **Historique des sessions** : évolution de la meilleure médiane session par session avec indicateurs colorés (vert = amélioré, rouge = dégradé)
- **Filtre outliers** : input "Temps max" dans la config pour exclure les tours aberrants du graphe et des calculs
- **Exclusion premier tour** : le tour de sortie de pit est automatiquement ignoré dans les calculs et le graphe
- **Composant Podium** : extrait en composant réutilisable (`Podium.jsx`) avec stats résumé (tours réalisés/configurés, durée réelle/configurée, grace période, meilleur tour)
- **Refonte page détail session** : migration shadcn/ui, podium, leaderboard intégré, historique des tours, support balancing avec graphe, DNF

### Changed
- **SessionSection** : colonnes Pilote et Grille masquées pour les sessions balancing, Grace période remplacée par Temps max
- **Sidebar** : entrée "Équilibrage" ajoutée après Statistiques (icône Scale)
- **event session:bestlap** : inclut désormais `sessionType` pour désactiver les annonces vocales en balancing
- **Sidebar en session** : reste ouverte pendant les sessions d'équilibrage (pas de collapse automatique)
- **Refonte pages détail** : TrackProfile, DriverProfile, CarProfile migrées en shadcn/ui avec header compact, stats inline, sessions cliquables
- **Migration composants CRUD** : FormModal, Modal, PageHeader, EmptyState, EntityCard, ColorPickerField, RangeField, PhotoUploadField, RecordDisplays en shadcn/ui
- **Suppression primaryColor** : toutes les couleurs hardcodées remplacées par tokens sémantiques (`text-primary`, `bg-card`, `border-border`)
- **Tri historique sessions** : tri par `updatedAt` (au lieu de `createdAt`) pour que les sessions modifiées/reset remontent
- **Colonne Date historique** : affiche `updatedAt` au lieu de `createdAt`
- **Podium stats** : affiche tours réalisés/max, durée réelle/configurée, grace période avec fallback 30s
- **Couleurs types de session unifiées** : essais=violet, qualif=bleu, course=vert, équilibrage=orange sur toutes les pages
- **Dashboard classement pilotes** : courses/victoires/podiums colorés, nombre de courses affiché
- **Mode production** : le backend Express sert le frontend buildé sur un seul port (3001), démarrage instantané
- **Mise à jour depuis l'app** : section dans Settings pour vérifier et appliquer les mises à jour (git pull, npm install, build, prisma, restart automatique)
- **Progression mise à jour** : barre de progression WebSocket en temps réel, affichage erreurs, auto-reconnect après restart
- **Scripts d'installation** : `RaceHubOS-install-mac.command` et `RaceHubOS-install-win.bat` — un seul script à télécharger et lancer
- **Auto-install prérequis** : Homebrew/Git/Node.js (Mac) ou Git/Node.js via winget (Windows)
- **App Bureau macOS** : `.app` avec icône custom, lance le serveur + ouvre le navigateur
- **Launcher avec auto-restart** : boucle restart (exit code 42) pour supporter les mises à jour depuis l'app
- **Kill port au lancement** : le launcher libère le port 3001 si déjà occupé
- **Fallback DATABASE_URL** : le backend crée automatiquement la connexion SQLite si .env absent
- **Version dynamique** : lue depuis package.json, plus de valeur hardcodée

### Fixed
- **isPitLap** : champ inexistant remplacé par `deletedAt` dans stats.js
- **Git pull safe** : `checkout + pull --ff-only` préserve DB/uploads/.env
- **Cache version GitHub** : utilise l'API GitHub au lieu de raw.githubusercontent (pas de cache CDN)
- **react-is** : dépendance manquante de recharts ajoutée

## [1.6.0] - 2026-04-10

### Added
- **Annonce vocale meilleur tour** : synthèse vocale FR quand un nouveau record de session est établi (nom du pilote + temps)
- **Annonce podium fin de course** : annonce vocale 3e → 2e → 1er avec temps total (race) ou meilleur tour (qualif) après la musique de fin
- **VoiceContext** : service dédié pour la gestion vocale (speak, formatTimeVoice, préférences)
- **Settings voix** : toggle activation, seuil tours minimum configurable (1-20, défaut 3), sélecteur de voix FR avec bouton test
- **Colonne Total (race)** : le leader affiche son temps total, les autres l'écart — colonne unique fusionnée

### Changed
- **Écart qualif/practice** : le leader affiche son meilleur tour en violet au lieu de "Leader"
- **event session:finished** : inclut désormais `sessionType` pour différencier race/qualif dans les annonces
- **Persistance session libre** : circuit et mode (practice/qualif/race) sauvegardés dans localStorage via AppContext
- **Copie auto drivers** : changement de type en session libre copie la config pilotes/voitures de la session précédente
- **Tri podium practice** : aligné avec le leaderboard (tours desc → bestLap asc) pour éviter les incohérences

### Fixed
- **Double attribut style** : fix du podium SessionSection (ringColor + backgroundColor fusionnés)
- **Podium non affiché** : session.drivers mis à jour avec le leaderboard final à la fin de session
- **Classement race vide** : mapping `totalLaps` manquant dans les records de sessions libres
- **Classement non rafraîchi** : refetch standings automatique après fin de session (event listener)

## [1.5.0] - 2026-04-06

### Added
- **AppContext** : contexte unifié pour les préférences UI (theme, admin, sidebar, standings), remplace ThemeContext
- **Titre session éditable** : clic sur le titre pour éditer inline (contentEditable), auto-save au blur
- **Config session inline** : table controllers toujours visible avec selects inline et auto-save, plus de mode formulaire
- **Config durée/tours/grace** : inputs inline pour qualif et course (sessions libres et championnats)
- **Podium fin de course** : affichage visuel du podium (1er/2ème/3ème) avec avatars, écarts, meilleur tour et stats
- **Feux de départ** : sons bip à chaque feu, touche Espace pour lancer, touche Échap et bouton croix pour annuler
- **Persistance sidebar/standings** : état sauvegardé dans localStorage, fermeture auto en course, restauration après
- **Sync config sessions libres** : modification pilotes/voitures propagée aux autres types (practice/qualif/race)
- **Migration DB** : sessions 'ready' migrées vers 'draft'

### Changed
- **Status ready supprimé** : cycle simplifié draft → active → paused → finishing → finished
- **Démarrage direct** : bouton "Démarrer" depuis draft (plus besoin de passer par "Prêt")
- **Classement général** : couleurs podium flashy (badges ronds colorés, gradients, bordures), plus de limite 5 pilotes
- **Gradient dark mode** : utilise `var(--card)` au lieu de hex hardcodé
- **Grille de départ** : border et gradient toujours à gauche
- **Reset session** : soft delete des laps pour tous les types (plus de hard delete pour qualif/race)
- **Barres de progression** : masquées quand session terminée (infos dans le podium)
- **Config incomplète** : bloque le démarrage si pilote sans voiture ou inversement

### Fixed
- **gridPos** : ajouté au leaderboard endpoint et SessionService (positions grille fonctionnelles)
- **Re-renders infinis** : fix useEffect deps dans FreeSessionPage, ChampionshipDetail, SessionSection
- **Timing après reset** : remise à zéro du timing dans resetSession et loadSession
- **handleSaveConfig** : pas de PUT/PATCH inutiles quand seuls les drivers changent
- **Nom session libre** : plus de doublon "Essais libres libre"

### Removed
- **ThemeContext** : fusionné dans AppContext
- **Tests obsolètes** : 4 fichiers de tests supprimés (importaient des modules renommés/supprimés)

## [1.2.0] - 2026-03-28

### Added
- **Sidebar shadcn/ui** : migration vers le composant Sidebar de shadcn/ui (style dashboard-01) avec `SidebarProvider`, `SidebarInset`, collapsible en mode "icon", raccourci clavier `Ctrl+B`, support mobile via Sheet, tooltips en mode collapsed
- **Logo** : nouveau logo RaceHubOS dans la sidebar
- **Header layout** : barre supérieure avec `SidebarTrigger`, titre de page dynamique, compteur de résultats, toggle grille/liste et bouton d'ajout (remontés depuis ListPage)
- **Footer statut CU** : barre inférieure fixe avec état de connexion CU, mode, dernier tour
- **Dark mode Zinc** : palette dark mode passée en Zinc (gris neutres/bleutés)
- **Dashboard** : refonte complète avec records absolus, classement pilotes top 10, meilleurs tours, stats cards, bannière session active ; données limitées aux championnats (sessions libres exclues)
- **Filtre `has_championship`** : nouveau paramètre sur `/api/sessions`, `/api/stats/drivers`, `/api/stats/records`, `/api/stats/laptimes` pour exclure les sessions hors championnat
- **Settings** : migration vers composants shadcn/ui (Card, Button, icônes lucide), suppression header/lien retour redondants
- **Backend Status** : migration vers Sheet shadcn/ui (slide-in panel), icônes lucide, filtres par type de log
- **Migration lucide-react** : remplacement complet de `@heroicons/react` par `lucide-react` sur les 47 fichiers, suppression du package heroicons
- **Bouton édition (crayon)** : ajouté sur les cartes grille, les lignes de table (colonne actions fixe non déplaçable) et les pages profil (Pilotes, Voitures, Circuits)
- **Mode Libre** : migration vers composants shadcn/ui (Select, Tabs, Button)
- **DataTable** : support `meta.className` sur les colonnes, padding réduit sur colonnes select/actions
- **Sidebar** : réorganisation du menu (Mode Libre, Championnats, Historique, Circuits, Équipes, Pilotes, Voitures, Stats)
- **Mode Libre** : select circuit et type toujours cliquables, toggle classement général, tokens sémantiques, couleurs podium vives, empty state shadcn Card, sessions libres créées en statut "prêt" par défaut
- **Configuration session inline** : remplacement du modal par un formulaire intégré directement dans le bloc session (nom, durée, tours, controllers, statut)
- **Leaderboard expanded** : tailles agrandies (position, avatar, numéro, nom, stats) quand le classement général est masqué
- **Page Championnat** : migration shadcn (ChampionshipHeader, ChampionshipConfigModal en Sheet, tokens sémantiques), toggle classement général, config session inline, selects shadcn pour controllers et circuit
- **Leaderboard stats** : tailles agrandies en mode expanded (labels, tours, temps, gap), LapTime size `xl`
- **Script upgrade** : `RaceHubOS-upgrade.bat` avec prisma generate, raccourci bureau, launcher versionné
- **Terminer championnat** : bouton dans le header quand toutes les sessions Q/R sont terminées, bouton dans la config pour forcer la fin
- **Soft delete / hard delete** : DELETE fait un soft delete, re-DELETE fait un hard delete, PATCH restore sur toutes les entités (drivers, cars, tracks, teams, championships, sessions, laps)
- **ListPage supprimés** : boutons Restaurer + Supprimer définitivement en mode "Afficher les supprimés", confirmation modale, déselection auto après action
- **Stats laps** : endpoint DELETE/restore pour les laps, filtre "Afficher les supprimés" sur la page Stats
- **DataTable** : toolbar sticky, empty state avec icône Search
- **Auto-collapse au start** : sidebar et classement général se ferment automatiquement au démarrage d'une session (Mode Libre et Championnat)
- **Vue par défaut** : option dans les paramètres pour choisir Grille ou Liste par défaut sur toutes les pages
- **PageHeaderContext** : context React pour remonter les éléments de header des pages enfants vers le layout
- **shadcn/ui** : intégration complète avec Tailwind v4, composants Popover, Select, Table, Checkbox, Input, Button, DropdownMenu, Skeleton, Badge, Card, Tabs
- **DataTable générique** (`data-table.jsx`) : composant réutilisable basé sur TanStack React Table avec recherche globale, sélection multiple, tri par colonne (asc/desc), filtres par colonne via Popover, drag & drop pour réorganiser les colonnes (avec animation framer-motion), visibilité des colonnes configurable, infinite scroll, skeleton de chargement
- **ListPage générique** (`list-page.jsx`) : layout page réutilisable avec header (icône + titre + compteur + bouton ajout), DataTable, barre d'actions de sélection, confirmation de suppression, empty state
- **FilterHeader** (`filter-header.jsx`) : header de colonne avec tri + icône funnel + popover d'options de filtre
- **Préférences utilisateur** : modèle `Preference` en DB (clé/valeur JSON), route `GET/PUT /api/preferences/:key`, sauvegarde de la visibilité et de l'ordre des colonnes par page
- **Soft delete** : champ `deletedAt` sur Championship, Session, SessionDriver, Lap, Driver, Car, Track, Team, TrackRecord ; suppression en cascade via `deletedAt` au lieu de hard delete ; filtre "Afficher les supprimés" dans les tableaux
- **Lazy loading** : toutes les pages chargées dynamiquement via `React.lazy()` + `Suspense`, bundle principal réduit de 900KB à 317KB

### Changed
- **Tailwind v3 → v4** : migration vers Tailwind CSS v4 avec plugin Vite natif (`@tailwindcss/vite`), support oklch, suppression de postcss.config.js et tailwind.config.js
- **Stats : filtres et tri côté serveur** : tous les filtres, le tri et la pagination sont désormais gérés par le backend (Prisma orderBy / skip / take), suppression du tri client-side
- **Stats : infinite scroll** : remplacement du filtre "Nombre max" par un scroll infini avec chargement progressif par pages de 50
- **Stats : regroupement pilote×voiture optionnel** : le regroupement par meilleur tour par combo pilote/voiture/circuit est maintenant désactivable via une checkbox
- **API `/api/stats/laptimes`** : ajout des paramètres `offset`, `sortBy` (lapTime, driver, car, track, sessionType, date), `sortOrder`, `unique` ; retourne `total` et `hasMore` pour la pagination
- **API `/api/championships`** : ajout des paramètres `offset`, `limit`, `trackId`, `status`, `deleted` ; retourne `total` et `hasMore`
- **API `/api/sessions`** : ajout des paramètres `offset`, `limit`, `deleted` ; retourne `total` et `hasMore`
- **Sessions : vue DataTable** : remplacement de la vue liste custom par le DataTable générique avec filtres par colonne (type, circuit, statut, championnat), tri, sélection, drag & drop
- **Championnats : vue DataTable** : remplacement de la grille de cartes par le DataTable générique avec filtres par colonne (circuit, statut), tri, sélection, drag & drop
- **Lap.softDeletedAt → Lap.deletedAt** : renommage pour cohérence avec les autres modèles
- **Suppression** : passage de hard delete à soft delete avec cascade sur Session et Championship
- **Circuits : vue DataTable** : remplacement de la grille de cartes par le DataTable générique avec tri, sélection, recherche, infinite scroll, drag & drop colonnes
- **Stats : vue DataTable** : remplacement du tableau custom par le DataTable générique avec filtres par colonne (pilote, voiture, circuit, session), avatars, médailles top 3, infinite scroll
- **API `/api/tracks`** : ajout des paramètres `offset`, `limit`, `deleted` ; retourne `total` et `hasMore`
- **Pilotes : vue DataTable + grille** : toggle grille/liste avec shadcn Tabs, DataTable avec colonnes (pilote, n°, équipe, courses, victoires, podiums, tours, record), cartes originales avec racing stripe/gradient/blur en mode grille
- **Voitures : vue DataTable + grille** : colonnes séparées marque/modèle/année, barres vitesse/freinage, record, sessions, cartes avec specs en mode grille
- **Équipes : vue DataTable + grille** : colonnes (nom, couleur, pilotes), cartes avec liste pilotes en mode grille
- **Circuits : vue grille** : ajout du mode grille avec cartes (specs longueur/virages, record, sessions)
- **API `/api/drivers`** : ajout des paramètres `offset`, `limit`, `deleted`, `sortBy`, `sortOrder` ; tri par `_count` sessions/laps ; retourne `total` et `hasMore`
- **API `/api/cars`** : ajout des paramètres `offset`, `limit`, `deleted`, `sortBy`, `sortOrder` ; tri par `_count` sessions ; retourne `total` et `hasMore`
- **API `/api/teams`** : ajout des paramètres `offset`, `limit`, `deleted`, `sortBy`, `sortOrder` ; tri par `_count` drivers ; retourne `total` et `hasMore`
- **Toggle grille/liste** : composant shadcn Tabs dans ListPage, préférence sauvegardée en DB

### Fixed
- **Tri toutes les pages** : tri côté serveur pour les colonnes calculées (relations, comptages, durées) sur championnats, sessions, pilotes, voitures, circuits
- **Suppression des voitures liées à des sessions** : ajout d'une transaction Prisma pour supprimer en cascade les SessionDriver, Lap et FuelStop associés avant de supprimer la voiture
- **Affichage "Pilote non trouvé"** : ajout de vérification `res.ok` avant de parser la réponse JSON dans DriverProfile
- **Images non affichées en vue liste des voitures** : ajout du rendu conditionnel de `car.img` dans CarTable avec fallback sur l'initiale de la marque
- **Couleurs toutes vertes en vue liste des voitures** : utilisation de `car.color` au lieu de la couleur par défaut dans CarTable pour les badges, barres de progression et avatars
- **Compteurs pilotes/voitures à 0 sur le dashboard** : ajout de vérifications `res.ok` sur les appels API du Dashboard avant de mettre à jour les états
- **Simulateur accessible sans mode admin** : ajout de la condition `isAdmin &&` sur le lien vers /simulator dans la sidebar

## [0.1.0] - 2026-01-23

### Changed
- **SessionDriver** : `driverId` et `carId` sont maintenant optionnels dans le schéma Prisma pour permettre les configurations partielles en brouillon
- **Route sessions** : mise à jour du filtre pour accepter les configs avec pilote OU voiture (pas obligatoirement les deux)
- **Images** : stockage du chemin relatif (`/api/img/type/filename`) au lieu de l'URL complète, endpoint `/api/img/:type/:filename` pour servir les images (évite les problèmes de port)
- **Settings** : masquage du simulateur dans la liste des appareils si l'utilisateur n'est pas admin

### Added
- **Page Statistiques refaite** : nouveau design avec tableau de tous les records, filtres (pilote, voiture, circuit, type de session, nombre max de résultats), colonnes triables, avatars cliquables vers les profils, médailles pour le top 3
- **Route API `/api/stats/laptimes`** : endpoint pour récupérer les meilleurs temps par combo pilote×voiture×circuit avec filtres et limite configurable
- **Design Top 10 Records amélioré** : nouveau composant `RecordDisplays` avec médailles or/argent/bronze pour le top 3, avatars pilotes et voitures empilés, badges colorés pour le type de session (Course/Qualif/Essais)
- **Validation configuration incomplète** : blocage du passage en statut "Prêt" si un contrôleur a un pilote sans voiture ou inversement, avec message d'avertissement visuel
- **Sauvegarde brouillon partielle** : possibilité de sauvegarder une configuration avec seulement le pilote ou seulement la voiture assignée
- **Numéros de pilotes à 3 chiffres** : augmentation de la largeur du badge (w-16 → w-20) et taille de police adaptative selon le nombre de chiffres dans SessionLeaderboard
- **Image voiture dans leaderboard** : affichage de l'image de la voiture à côté du numéro du pilote dans le classement en course
- **Bouton "Reset stats"** : ajout sur les pages profil pilote, voiture et circuit avec suppression des données associées (laps, sessions, records) via transaction Prisma
- **Page profil voiture** (`/cars/:id`) : header stylisé, specs, Top 10 records (combo pilote × circuit avec type de session), sessions récentes
- **Page profil circuit** (`/tracks/:id`) : header avec image/specs (longueur, virages, courses), record du circuit, Top 10 records (combo pilote × voiture avec type de session), sessions récentes cliquables
- **Page profil pilote** (`/drivers/:id`) : Top 10 records (combo voiture × circuit avec type de session) remplace l'ancien affichage "Meilleurs tours"
- **Navigation vers profil** : clic sur une carte (pilote/voiture/circuit) navigue vers sa page profil, bouton crayon pour éditer
- Initial project setup
- Monorepo structure with backend and frontend packages
- SQLite database with Prisma ORM
- WebSocket server with Socket.io
- Mock simulator for development
- Multi-display support (admin, scoreboard, stats, timing, driver views)

### Architecture
- Backend: Node.js + Express + Socket.io + Prisma
- Frontend: React + Vite + TailwindCSS + shadcn/ui
- Database: SQLite
- Bluetooth: Web Bluetooth API
- Deployment target: Raspberry Pi with multiple displays

## [0.1.0] - 2025-11-21

### Added
- Project initialization
- Basic structure and configuration
