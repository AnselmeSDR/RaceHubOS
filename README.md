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
- React 18 + TypeScript
- Vite
- TailwindCSS + shadcn/ui
- Socket.io-client

**Backend:**
- Node.js 20 + TypeScript
- Express
- Socket.io
- Prisma + SQLite
- @abandonware/noble (Bluetooth LE)

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+

### Installation

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev
```

The frontend will be available at http://localhost:5173
The backend will be available at http://localhost:3000

### Development with Simulator

The app includes a built-in simulator that mimics the Carrera Control Unit.
No physical hardware required for development!

## Project Structure

```
racehubos/
├── packages/
│   ├── backend/       # Node.js API + WebSocket server
│   ├── frontend/      # React application
│   └── shared/        # Shared TypeScript types
└── docs/              # Documentation
```

## Documentation

See [DEV-NOTES.md](../openlap/DEV-NOTES.md) for detailed technical documentation.

## License

Apache-2.0

## Credits

- Protocol reverse engineering: Stephan Heß (slotbaer.de)
- carreralib: Thomas Kemmer
- OpenLap: Thomas Kemmer
