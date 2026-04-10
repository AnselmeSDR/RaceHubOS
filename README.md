# 🏁 RaceHubOS

Open Source Race Management System for Carrera Digital 132/124

## ✨ Features

- 📊 Real-time race leaderboard with animated positions
- 👤 Driver, car, track and team management with photos
- 🏆 Championship system with multi-session support (Practice, Qualifying, Race)
- 📈 Standings and statistics per championship and session type
- ⚙️ Session configuration inline (controllers, duration, laps, grace period)
- 🥇 Podium display at end of session with gap and best lap info
- 🗣️ Voice announcements (best lap, podium results) via Web Speech API
- 🎙️ Configurable voice settings (voice selection, min laps threshold)
- 🚦 Start lights sequence with audio cues
- 🌙 Dark mode (Zinc palette)
- 🔌 Bluetooth LE connectivity to Carrera Control Unit via AppConnect
- 🎮 Built-in simulator for development (no hardware required)
- 🏎️ Free session mode with persistent track/type selection
- 📺 Driver displays for external screens

## 🛠️ Tech Stack

**Frontend:**
- React 19 + JavaScript (ES6+)
- Vite
- TailwindCSS + shadcn/ui
- Socket.io-client
- Framer Motion

**Backend:**
- Node.js 20+ + JavaScript (ES6+ modules)
- Express + Socket.io
- Prisma + SQLite (WAL mode)
- Built-in race simulator

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- Git

> **Note :** L'application tourne actuellement en mode **développement** (`npm run dev`) sur toutes les plateformes. Le backend Express ne sert pas encore les fichiers statiques du frontend buildé — le frontend nécessite le serveur Vite pour fonctionner. À terme, des builds packagés (`.exe`, `.app`, `.AppImage`) sont prévus pour simplifier l'installation et supprimer la dépendance à Node.js.

### 🍎 macOS / 🐧 Linux

```bash
# Clone the repo
git clone https://gitlab.com/AnselmeSDR/RaceHubOS.git
cd RaceHubOS

# Install dependencies
npm install

# Initialize the database
cd packages/backend
npx prisma generate
npx prisma db push
cd ../..

# Start the app (frontend + backend)
npm run dev
```

L'app s'ouvre sur http://localhost:5173 (frontend) et http://localhost:3001 (backend API).

### 🪟 Windows

#### Première installation

1. Télécharger `RaceHubOS-upgrade.bat` depuis le repo
2. Le placer sur le Bureau
3. Double-cliquer pour lancer

Le script automatise tout :
- Clone le repo dans `C:\Users\<user>\RaceHubOS-v<version>`
- Installe les dépendances (`npm install`)
- Génère le client Prisma et applique les migrations
- Crée un lanceur `RaceHubOS-v<version>.bat` (lance `npm run dev` + ouvre le navigateur)
- Crée un raccourci sur le Bureau avec l'icône

#### Utilisation

Double-cliquer sur le raccourci **RaceHubOS** sur le Bureau. Le navigateur s'ouvre automatiquement après quelques secondes.

#### 🔄 Mise à jour

1. Double-cliquer sur `RaceHubOS-upgrade.bat` sur le Bureau
2. Le script détecte automatiquement la dernière version installée (tri semver)
3. Clone la nouvelle version, copie la base de données et les uploads
4. Crée un nouveau lanceur et raccourci
5. Affiche le changelog à la fin
6. Les anciennes versions ne sont pas supprimées (rollback possible)

## 📁 Project Structure

```
racehubos/
├── packages/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── index.js              # Main server + WebSocket
│   │   │   ├── routes/               # REST API (14 route files)
│   │   │   └── services/
│   │   │       ├── SessionService.js  # Session lifecycle + leaderboard
│   │   │       ├── SyncService.js     # Hardware sync (CU/Simulator)
│   │   │       ├── ChampionshipService.js
│   │   │       ├── ConfigService.js
│   │   │       ├── controlUnit.js     # Carrera CU protocol
│   │   │       ├── simulator.js       # Built-in race simulator
│   │   │       └── ble.js             # Bluetooth LE
│   │   └── prisma/
│   │       └── schema.prisma          # Database schema
│   └── frontend/
│       └── src/
│           ├── context/               # App, Session, Device, Voice, PageHeader
│           ├── components/
│           │   ├── ui/                # shadcn/ui components
│           │   ├── race/              # Leaderboard, LapTime, GapDisplay, StartingGrid
│           │   ├── championship/      # SessionSection, StandingsTabs, ConfigModal
│           │   ├── session/           # Session components
│           │   └── crud/              # Generic CRUD components
│           └── pages/                 # 18 pages (Dashboard, Championships, Drivers, etc.)
├── CHANGELOG.md
└── RaceHubOS-upgrade.bat              # Windows upgrade script
```

## 📖 Documentation

- [CHANGELOG](CHANGELOG.md) - Version history

## 🧑‍💻 Development

### 🎮 Simulator

The built-in simulator mimics the Carrera Control Unit. No hardware required.

1. Open Settings
2. Connect to "Simulator"
3. Configure a session and start

### 🔌 WebSocket Events

Key events emitted by the backend:
- `session:leaderboard` - Real-time leaderboard updates
- `session:heartbeat` - Timing, remaining time/laps, leaderboard sync
- `session:bestlap` - New session best lap (triggers voice announcement)
- `session:finished` - Session end with final leaderboard
- `session:status_changed` - Session lifecycle transitions
- `cu:status` - Control Unit status (lights, mode, fuel)
- `cu:timer` - Raw lap/sector times from hardware

## 🤝 Contributing

RaceHubOS is an active project with a lot of room to grow. Here are some directions we'd love help with:

- 🍓 **Raspberry Pi** — Run the app on a dedicated Pi for a permanent race station
- 📱 **Tablet control** — Touch-friendly interface for race direction from a tablet
- 📺 **External displays** — Dedicated screens for spectators (leaderboard, live timing, standings)
- 🏗️ **Packaged builds** — Standalone `.exe`, `.app`, `.AppImage`
- 🧩 **New features** — Penalties, fuel strategy, team relay races, lap charts, and more

All contributions are welcome — whether it's a feature, a bug fix, a design idea, or just feedback.

- **Ideas & bugs** — [Open an issue](https://gitlab.com/AnselmeSDR/RaceHubOS/-/issues)
- **Code** — Fork, branch, and submit a merge request
- **Questions** — Reach out at anselme8@icloud.com

## 📄 License

Apache-2.0

## 🙏 Credits

**Project**
- Anselme Schneider — Founder & Developer (anselme8@icloud.com)
- Romain Danna — Co-author (domain & race expertise)

**Libraries & References**
- Protocol reverse engineering: Stephan Hess (slotbaer.de)
- carreralib: Thomas Kemmer
- OpenLap: Thomas Kemmer

Vibe coded with [Claude Code](https://claude.ai/code)
