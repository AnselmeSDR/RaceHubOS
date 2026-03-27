# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **shadcn/ui** : intégration complète avec Tailwind v4, composants Popover, Select, Table, Checkbox, Input, Button, DropdownMenu, Skeleton
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

### Fixed
- **Suppression des voitures liées à des sessions** : ajout d'une transaction Prisma pour supprimer en cascade les SessionDriver, Lap et FuelStop associés avant de supprimer la voiture
- **Affichage "Pilote non trouvé"** : ajout de vérification `res.ok` avant de parser la réponse JSON dans DriverProfile
- **Images non affichées en vue liste des voitures** : ajout du rendu conditionnel de `car.img` dans CarTable avec fallback sur l'initiale de la marque
- **Couleurs toutes vertes en vue liste des voitures** : utilisation de `car.color` au lieu de la couleur par défaut dans CarTable pour les badges, barres de progression et avatars
- **Compteurs pilotes/voitures à 0 sur le dashboard** : ajout de vérifications `res.ok` sur les appels API du Dashboard avant de mettre à jour les états
- **Simulateur accessible sans mode admin** : ajout de la condition `isAdmin &&` sur le lien vers /simulator dans la sidebar

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
