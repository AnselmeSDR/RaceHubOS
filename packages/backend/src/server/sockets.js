/** Socket events run on the simulator, when it is connected (`simulator:*` are legacy direct controls). */
const SIMULATOR_COMMANDS = [
  ['race:pause', 'togglePause'],
  ['simulator:start', 'start'],
  ['simulator:stop', 'stop'],
  ['simulator:pause', 'togglePause'],
];

/**
 * What a browser receives on connecting (the current device's state), and the race and
 * simulator commands it may send.
 */
export function handleSockets(io, { syncService, simulator, controlUnit }) {
  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    const device = syncService.getDevice();
    if (device === simulator && simulator.isConnected()) {
      socket.emit('cu:connected');
      socket.emit('race:status', {
        running: simulator.isRunning,
        active: simulator.raceActive,
        raceTime: simulator.raceTime,
        carCount: simulator.cars.length,
        deviceType: 'simulator',
      });
    } else if (device === controlUnit && controlUnit.isConnected()) {
      socket.emit('cu:connected');
      socket.emit('cu:status', { connected: true, deviceType: 'controlUnit' });
    } else {
      socket.emit('cu:status', { connected: false, deviceType: null });
    }

    socket.on('disconnect', () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
    });

    // Race control goes through the sync service, whatever the device
    socket.on('race:start', async (data) => {
      console.log('▶️  Race start requested:', data);
      await syncService.startRace();
    });
    socket.on('race:stop', async () => {
      console.log('⏹️  Race stop requested');
      await syncService.stopRace();
    });
    socket.on('car:setSpeed', (data) => {
      console.log('🏎️  Set speed:', data);
      if (simulator.isConnected()) simulator.setCarSpeed(data.carId, data.speed);
    });
    for (const [event, command] of SIMULATOR_COMMANDS) {
      socket.on(event, () => {
        if (simulator.isConnected()) simulator[command]();
      });
    }

    socket.on('simulator:getState', () => {
      const current = syncService.getDevice();
      if (current === simulator) socket.emit('simulator:state', simulator.getState());
      else if (current === controlUnit) socket.emit('cu:state', { connected: controlUnit.isConnected() });
      else socket.emit('cu:state', { connected: false });
    });
  });
}
