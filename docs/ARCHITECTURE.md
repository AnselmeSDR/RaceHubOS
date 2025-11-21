# RaceHubOS Architecture

## Overview

RaceHubOS is a race management system designed to run on a Raspberry Pi with multiple displays connected physically to the device.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Raspberry Pi                              │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Backend (Node.js)                       │  │
│  │  - Express API                                       │  │
│  │  - Socket.io WebSocket Server                        │  │
│  │  - Prisma ORM + SQLite                              │  │
│  │  - Web Bluetooth or Mock Simulator                   │  │
│  └────────────┬─────────────────────────────────────────┘  │
│               │                                              │
│  ┌────────────▼─────────────────────────────────────────┐  │
│  │         Frontend (React + Vite)                      │  │
│  │  - Multiple routes for different displays            │  │
│  │  - Real-time updates via WebSocket                   │  │
│  │  - TailwindCSS + shadcn/ui                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────┬───────────────┬───────────────┬──────────────┘
               │               │               │
       ┌───────▼──────┐ ┌─────▼──────┐ ┌─────▼──────┐
       │   Display 1  │ │ Display 2  │ │ Display 3  │
       │  (Tactile)   │ │ (Écran TV) │ │   (Stats)  │
       │    /admin    │ │/scoreboard │ │  /timing   │
       └──────────────┘ └────────────┘ └────────────┘
```

## Display Routes

### `/admin` - Central Control (Tactile)
Main control interface for race management:
- Start/Stop/Pause race
- Configure race settings
- Manage drivers, cars, tracks
- View real-time race status
- Control all other displays

### `/display/scoreboard` - Main Scoreboard (TV/Large Screen)
Primary display showing:
- Current positions
- Lap times (current, best, last)
- Gap to leader
- Fuel levels
- Pit stop status

### `/display/stats` - Statistics & Graphs
Secondary display with:
- Lap time evolution charts
- Position changes over time
- Driver statistics
- Race analytics

### `/display/timing` - Detailed Timing
Detailed timing screen:
- All lap times
- Sector times
- Best laps comparison
- Timing tower

### `/display/driver/:id` - Individual Driver View
Personal view for each driver (optional):
- Own position and times
- Gap to leader/next car
- Own fuel level
- Personal best laps

## Data Flow

```
AppConnect/Simulator
        ↓
   Backend Parser
        ↓
   Race Engine
        ↓
   WebSocket Broadcast
        ↓
  All Connected Displays (Real-time update)
```

## Technology Stack

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Express
- **WebSocket**: Socket.io
- **Database**: SQLite
- **ORM**: Prisma
- **Bluetooth**: Web Bluetooth API (browser-based)

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Styling**: TailwindCSS
- **Components**: shadcn/ui
- **Charts**: Recharts
- **State**: React Context + Hooks
- **Routing**: React Router v6

### Database Schema
See `packages/backend/prisma/schema.prisma` for full schema.

Main entities:
- Driver
- Car
- Track
- Race
- RaceResult
- LapTime
- Championship
- DriverStats

## Deployment on Raspberry Pi

### Hardware Requirements
- Raspberry Pi 4 (4GB+ RAM recommended)
- Multiple displays (HDMI, USB-C)
- Optional: Touchscreen for admin interface
- Carrera AppConnect (Bluetooth dongle)

### Software Setup
1. Install Node.js 20+
2. Clone repository
3. Install dependencies: `npm install`
4. Initialize database: `npm run prisma:migrate -w @racehubos/backend`
5. Build frontend: `npm run build -w @racehubos/frontend`
6. Start backend: `npm start -w @racehubos/backend`
7. Configure displays to auto-open different URLs

### Display Configuration
Each physical display opens a different URL in fullscreen kiosk mode:
- Display 1: `http://localhost:3000/admin`
- Display 2: `http://localhost:3000/display/scoreboard`
- Display 3: `http://localhost:3000/display/stats`
- etc.

Use Chromium in kiosk mode:
```bash
chromium-browser --kiosk --app=http://localhost:3000/admin
```

## Development

### With Simulator (No Hardware)
```bash
npm run dev
```
Backend runs on `http://localhost:3000`
Frontend runs on `http://localhost:5173`

The simulator mocks all Control Unit behavior for development without physical hardware.

### With Real AppConnect
1. Set `USE_MOCK_DEVICE=false` in `.env`
2. Ensure Web Bluetooth API permissions in browser
3. Connect to Control Unit via `/admin` interface

## WebSocket Events

### Client → Server
- `race:start` - Start race
- `race:pause` - Pause race
- `race:stop` - Stop race
- `car:setSpeed` - Set car speed
- `car:setBrake` - Set car brake
- `car:setFuel` - Set car fuel

### Server → Client
- `race:timer` - Lap/sector crossing event
- `race:status` - Periodic status update
- `race:lap` - Lap completed
- `race:started` - Race started
- `race:finished` - Race finished
- `car:pit` - Car pit stop

## Security Considerations

- Local network only (no internet exposure)
- No authentication required (trusted local environment)
- SQLite file-based database (no external DB server)
- WebSocket restricted to local connections

## Performance Optimization

- Server-side rendering disabled (CSR only)
- WebSocket for real-time updates (no polling)
- Efficient React rendering (memo, useMemo, useCallback)
- Lightweight SQLite queries
- Minimal bundle size with Vite

## Future Enhancements

- [ ] Bluetooth LE native support (noble)
- [ ] Multi-device sync (SmartRace Connect clone)
- [ ] Advanced statistics and AI predictions
- [ ] Video replay integration
- [ ] Voice announcements
- [ ] Weather simulation
- [ ] Damage simulation
- [ ] Virtual Safety Car
