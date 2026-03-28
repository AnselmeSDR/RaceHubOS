# RaceHubOS 🏁

Open Source Race Management System for Carrera Digital 132/124

## Features

- 📊 Real-time race scoreboard
- 👤 Driver management
- 🏆 Championship tracking
- 📈 Advanced statistics
- 🔌 Bluetooth LE connectivity via AppConnect
- 🎮 Built-in simulator for development
- 🏁 **Multi-phase sessions** (Practice → Qualifying → Race)
  - Separate leaderboards per phase
  - Smart sorting based on phase type
  - Real-time phase switching

## Tech Stack

**Frontend:**
- React 19 + JavaScript (ES6+)
- Vite
- TailwindCSS
- Socket.io-client
- Web Bluetooth API

**Backend:**
- Node.js 20+ + JavaScript (ES6+ modules)
- Express
- Socket.io
- Prisma + SQLite
- Built-in race simulator

## Getting Started

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

### Installation (Windows - production)

1. Télécharger `RaceHubOS-upgrade.bat` depuis le repo
2. Le placer sur le Bureau
3. Double-cliquer pour lancer

Le script :
- Clone le repo dans `C:\Users\<user>\RaceHubOS-v<version>`
- Installe les dépendances (`npm install`)
- Copie la base de données et les uploads depuis la version précédente
- Génère le client Prisma et applique les migrations
- Crée un lanceur `RaceHubOS-v<version>.bat`
- Crée un raccourci sur le Bureau avec l'icône

### Mise à jour (upgrade)

1. Double-cliquer sur `RaceHubOS-upgrade.bat` sur le Bureau
2. Le script détecte automatiquement la dernière version installée (tri semver)
3. Clone la nouvelle version, copie les données, installe les dépendances
4. Crée un nouveau lanceur et raccourci
5. Affiche le changelog à la fin
6. Les anciennes versions ne sont pas supprimées (rollback possible)

### Development with Simulator

The app includes a built-in simulator that mimics the Carrera Control Unit.
No physical hardware required for development!

To use the simulator:
1. Open http://localhost:5173
2. Click "▶ Démarrer" in the "Simulateur de Course" section
3. Watch 6 simulated cars race in real-time with lap times, fuel consumption, and pit stops

The simulator provides:
- Realistic lap times and sector progression
- Automatic fuel consumption and pit stops
- Real-time leaderboard updates
- WebSocket events for all race data

## Project Structure

```
racehubos/
├── packages/
│   ├── backend/       # Node.js API + WebSocket server + Simulator
│   │   ├── src/
│   │   │   ├── index.js          # Main server
│   │   │   └── services/
│   │   │       └── simulator.js  # Race simulator
│   │   └── prisma/
│   │       └── schema.prisma     # Database schema
│   └── frontend/      # React application
│       └── src/
│           ├── App.jsx
│           └── pages/
│               └── Home.jsx      # Main dashboard
└── docs/              # Documentation
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md) - System architecture and design decisions
- [Multi-Phase Sessions](packages/backend/PHASES.md) - Session phases system (Practice/Qualifying/Race)
- [CHANGELOG](CHANGELOG.md) - Version history and changes

## API

**REST Endpoints:**
- `GET /health` - Health check
- `GET /api` - API information
- `GET /api/simulator` - Simulator state
- `POST /api/simulator/start` - Start simulator
- `POST /api/simulator/stop` - Stop simulator
- `POST /api/simulator/pause` - Pause/resume simulator

**WebSocket Events:**
- `race:status` - Race status updates
- `race:carData` - Car data updates (every second)
- `race:lap` - Lap completion events
- `race:sector` - Sector completion events
- `race:pitStop` - Pit stop events
- `race:leaderboard` - Leaderboard updates

## Development

This project was vibe coded with Claude Code.

## License

Apache-2.0

## Credits

- Protocol reverse engineering: Stephan Heß (slotbaer.de)
- carreralib: Thomas Kemmer
- OpenLap: Thomas Kemmer
