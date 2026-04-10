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

### Installation (development)

```bash
# Install dependencies
npm install

# Initialize the database
cd packages/backend
npx prisma generate
npx prisma db push
cd ../..

# Run in development mode (starts both frontend and backend)
npm run dev
```

The frontend will be available at http://localhost:5173
The backend will be available at http://localhost:3001

### 🪟 Installation (Windows - production)

1. Download `RaceHubOS-upgrade.bat` from the repo
2. Place it on the Desktop
3. Double-click to launch

The script:
- Clones the repo into `C:\Users\<user>\RaceHubOS-v<version>`
- Installs dependencies (`npm install`)
- Copies the database and uploads from the previous version
- Generates the Prisma client and applies migrations
- Creates a launcher `RaceHubOS-v<version>.bat`
- Creates a Desktop shortcut with the icon

### 🔄 Upgrade

1. Double-click `RaceHubOS-upgrade.bat` on the Desktop
2. The script auto-detects the latest installed version (semver sort)
3. Clones the new version, copies data, installs dependencies
4. Creates a new launcher and shortcut
5. Displays the changelog at the end
6. Previous versions are not deleted (rollback possible)

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

## 📄 License

Apache-2.0

## 🙏 Credits

- Protocol reverse engineering: Stephan Hess (slotbaer.de)
- carreralib: Thomas Kemmer
- OpenLap: Thomas Kemmer
- Vibe coded with [Claude Code](https://claude.ai/code)
