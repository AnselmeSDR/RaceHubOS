# RaceHubOS 🏁

Open Source Race Management System for Carrera Digital 132/124

## Features

- 📊 Real-time race scoreboard
- 👤 Driver management
- 🏆 Championship tracking
- 📈 Advanced statistics
- 🔌 Bluetooth LE connectivity via AppConnect
- 🎮 Built-in simulator for development

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

### Installation

```bash
# Install dependencies
npm install

# Initialize the database
npm run prisma:generate -w @racehubos/backend
npm run prisma:migrate -w @racehubos/backend

# Run in development mode (starts both frontend and backend)
npm run dev
```

The frontend will be available at http://localhost:5173
The backend will be available at http://localhost:3000

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
