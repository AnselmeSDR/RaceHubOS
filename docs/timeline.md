# RaceHubOS — Timeline

## v1.7.0

### Équilibrage
- Nouveau type de session `balancing` isolé des autres types
- Page dédiée `/balancing` avec sélecteur circuit
- Graphe recharts LineChart temps au tour en temps réel (une courbe par voiture)
- Médiane tous les 5 tours + meilleure médiane par voiture
- Delta entre voitures (écart meilleure médiane)
- Indicateur tendance : accélère / ralentit / stable (comparaison 1ère vs 2ème moitié)
- Premier tour (sortie pit) exclu automatiquement
- Filtre outliers configurable (temps max en secondes)
- Pas de podium, voice ni grille de départ

### Classement équilibrage
- Classement par voiture (distinct carId, pas driver+car)
- Best lap + meilleure médiane dans le panneau droit
- Historique meilleure médiane par session (badges colorés vert/rouge/neutre)
- Nombre de sessions et tours totaux par voiture

### Config balancing
- Colonnes Pilote et Grille masquées
- Grace période remplacée par input Temps max
- Sidebar reste ouverte pendant les sessions

### Détail session
- Refonte complète : migration shadcn/ui (Card, Badge, Button), tokens sémantiques
- Podium réutilisable (`Podium.jsx`) extrait de SessionSection
- Podium stats : tours réalisés/max, durée réelle/configurée, grace période si utilisée
- Leaderboard intégré via SessionLeaderboard (plus d'appel API séparé par phase)
- Support balancing : affiche BalancingChart au lieu du leaderboard
- Historique des tours : tableau scrollable avec highlight meilleur tour
- DNF listés
- Liens cliquables vers circuit et championnat

### Historique sessions
- Tri par défaut : `updatedAt` desc (sessions modifiées/reset remontent)
- Colonne Date : affiche `updatedAt`

### Backend
- `balancing` ajouté à SessionService (validation, phase, tri par bestLap)
- `lapHistory` Map en RAM pour les données de graphe (chargée depuis DB au loadSession)
- Leaderboard/heartbeat enrichis avec `laps[]` pour les sessions balancing
- Records API : `getBalancingBestByCar()` avec best median + historique par session
- `session:bestlap` inclut `sessionType`

---

## v1.6.0

### Voice announcements
- VoiceContext dédié : speak(), formatTimeVoice(), préférences persistées
- Annonce meilleur tour : nom du pilote + temps quand un record de session est battu
- Annonce podium fin de course : 3e → 2e → 1er avec temps total (race) ou meilleur tour (qualif)
- Toggles séparés : meilleur tour (orange) et podium (jaune)
- Seuil configurable : tours minimum avant annonce (défaut 3)
- Sélecteur de voix FR avec bouton test dans Settings
- Protection anti-doublon (speechSynthesis.speaking)

### Leaderboard
- Race : colonne Total/Écart fusionnée (leader = temps total, autres = écart)
- Qualif/Practice : leader affiche son meilleur tour en violet au lieu de "Leader"
- Tri podium aligné avec leaderboard (practice : tours desc → bestLap asc)

### Session libre
- Persistance circuit et type sélectionnés dans AppContext (localStorage)
- Copie auto des drivers lors du changement de type (practice → qualif → race)
- Refetch standings après fin de session (event listener session:finished)
- Fix classement race vide (mapping totalLaps manquant)
- session.drivers mis à jour avec leaderboard final (fix podium non affiché)

### Backend
- SessionService émet `session:bestlap` avec driver/car info
- `session:finished` inclut `sessionType`
- `getSessionBestLapTime()` helper

### Repo & docs
- Miroir GitHub (dual push origin → GitLab + GitHub)
- Branch main protégée sur les deux (PR required, force push admin only)
- Discussions activées sur GitHub
- README bilingue EN/FR avec table des matières et screenshots
- Purge historique git (db, backups, shm/wal)
- Docs consolidés dans docs/ (plans, bluetooth, phases, architecture)

### Fixes
- Double attribut style dans SessionSection (ringColor + backgroundColor)
- Emails perso remplacés par @example.com dans seed.js
- Suppression fichiers inutiles (react.svg, WORK_LOG.txt)

---

## v1.5.0

### Architecture
- AppContext unifié : theme, admin, sidebar, standings, race override (remplace ThemeContext)
- SessionContext appelle AppContext.setSessionActive pour le race override
- Providers : AppProvider > SessionProvider > composants
- Persistance localStorage pour sidebar et classement général

### Session
- Status `ready` supprimé : cycle draft → active → paused → finishing → finished
- Titre éditable par clic inline (contentEditable + auto-save)
- Config controllers inline : selects sans bordure, auto-save à chaque changement
- Config durée/tours/grace period inline pour qualif et course
- Sync config entre sessions libres du même circuit (practice/qualif/race)
- Blocage démarrage si config incomplète (pilote sans voiture)
- Reset = soft delete des laps pour tous les types
- Fix timing après reset (remise à zéro complète)

### Fin de course
- Podium visuel : 2ème/1er/3ème, avatars, écarts, meilleur tour
- Stats résumé : tours, durée, grace period, meilleur tour
- Barres de progression masquées quand terminé

### Feux de départ
- Sons bip à chaque feu (Web Audio API)
- Touche Espace pour lancer au feu 1/5
- Touche Échap et bouton croix pour annuler (reset session)

### Classement général
- Couleurs podium flashy (badges ronds, gradients, bordures)
- Plus de limite 5 pilotes dans le classement
- Sidebar et standings se ferment en course, restaurés après

### Fixes
- gridPos propagé dans leaderboard endpoint et SessionService
- Fix re-renders infinis (useEffect deps, useMemo stabilisé)
- Fix nom session libre doublon "Essais libres libre"
- Fix gradient dark mode (var(--card) au lieu de hex)
- Grille de départ : border et gradient toujours à gauche

---

## v1.0.0 → v1.4.2

### UI/Design
- Migration complète vers shadcn/ui : Sidebar (dashboard-01), Sheet, Select, Tabs, Button, Card, Dialog, Badge, Input
- Migration heroicons → lucide-react (47 fichiers, package supprimé)
- Dark mode Zinc (gris neutres/bleutés)
- Nouveau logo RaceHubOS (voiture + podium)
- Sidebar collapsible avec raccourci Ctrl+B, auto-collapse au start de session

### Dashboard
- Refonte : records absolus, classement pilotes top 10, meilleurs tours
- Stats limitées aux championnats uniquement (sessions libres exclues)
- Fix lecture wins/podiums (d.statistics.wins au lieu de d.wins)

### Pages de course
- Config session inline (plus de modal, édition directement dans le bloc)
- Leaderboard expanded quand classement masqué (tailles agrandies)
- Toggle classement général (Mode Libre + Championnat)
- Sessions libres créées en statut ready par défaut
- Bouton Terminer le championnat

### Data management
- Soft delete / hard delete : 1er DELETE = soft, 2ème = hard, PATCH restore
- Boutons Restaurer + Supprimer définitivement dans les listes
- Bouton crayon (édition) sur cartes, listes, profils
- Vue par défaut (grille/liste) configurable dans Settings

### Backend
- Fix tri colonnes calculées (relations, comptages) sur toutes les routes

### Déploiement
- Script RaceHubOS-upgrade.bat : clone, npm install, copie DB/uploads, prisma generate, raccourci bureau, changelog
- Versioning semver, dossiers RaceHubOS-v<version>
