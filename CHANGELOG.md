# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.7.0] - 2026-04-11

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
- **Script upgrade macOS** (`RaceHubOS-upgrade.command`) : installation en un clic, auto-install Homebrew/Git/Node.js, création app .app sur le Bureau avec icône
- **Script upgrade Windows** : auto-install Git/Node.js via winget, création .env automatique
- **Fallback DATABASE_URL** : le backend crée automatiquement la connexion SQLite si .env absent

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
