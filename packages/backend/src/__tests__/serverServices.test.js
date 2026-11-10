import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

/** Service doubles that remember how they were built and wired, and nothing else. */
class Double extends EventEmitter {
  constructor(io) {
    super();
    this.io = io;
    this.links = {};
  }
  setSessionService(service) {
    this.links.session = service;
  }
  setSyncService(service) {
    this.links.sync = service;
  }
}
class SessionService extends Double {}
class ChampionshipService extends Double {
  onSessionFinished = jest.fn();
  onStandingsChanged = jest.fn();
}
const setters = {
  championship: jest.fn(),
  settingsIo: jest.fn(),
  controlUnit: jest.fn(),
  simulator: jest.fn(),
  sync: jest.fn(),
  session: jest.fn(),
  config: jest.fn(),
  updateIo: jest.fn(),
};

jest.unstable_mockModule('../services/SessionService.js', () => ({ SessionService }));
jest.unstable_mockModule('../services/ChampionshipService.js', () => ({ ChampionshipService }));
jest.unstable_mockModule('../services/ConfigService.js', () => ({ ConfigService: class extends Double {} }));
jest.unstable_mockModule('../services/SyncService.js', () => ({ SyncService: class extends Double {} }));
jest.unstable_mockModule('../services/controlUnit.js', () => ({ ControlUnit: class extends Double {} }));
jest.unstable_mockModule('../services/simulator.js', () => ({ CarreraSimulator: class extends Double {} }));
jest.unstable_mockModule('../routes/championships.js', () => ({ setChampionshipService: setters.championship }));
jest.unstable_mockModule('../routes/settings.js', () => ({ setSettingsIo: setters.settingsIo }));
jest.unstable_mockModule('../routes/bluetooth.js', () => ({
  setControlUnit: setters.controlUnit,
  setSimulator: setters.simulator,
  setSyncService: setters.sync,
}));
jest.unstable_mockModule('../routes/sessions.js', () => ({ setSessionService: setters.session }));
jest.unstable_mockModule('../routes/config.js', () => ({ setConfigService: setters.config }));
jest.unstable_mockModule('../routes/update.js', () => ({ setUpdateIo: setters.updateIo }));
const { createServices } = await import('../server/services.js');

describe('the running services', () => {
  const io = { name: 'io' };
  const services = createServices(io);
  const { sessionService, configService, championshipService, controlUnit, simulator, syncService } = services;

  test('each one is built once, the broadcasting ones on socket.io', () => {
    expect(sessionService.io).toBe(io);
    expect(configService.io).toBe(io);
    expect(championshipService.io).toBe(io);
    expect(simulator.io).toBe(io);
    expect(syncService.io).toBe(io);
    expect(controlUnit.io).toBeUndefined();
  });

  test('they know each other', () => {
    expect(syncService.links.session).toBe(sessionService);
    expect(sessionService.links.sync).toBe(syncService);
    expect(championshipService.links.session).toBe(sessionService);
  });

  test('the routes receive the ones they use', () => {
    expect(setters.controlUnit).toHaveBeenCalledWith(controlUnit);
    expect(setters.simulator).toHaveBeenCalledWith(simulator);
    expect(setters.sync).toHaveBeenCalledWith(syncService);
    expect(setters.session).toHaveBeenCalledWith(sessionService);
    expect(setters.championship).toHaveBeenCalledWith(championshipService);
    expect(setters.config).toHaveBeenCalledWith(configService);
    expect(setters.settingsIo).toHaveBeenCalledWith(io);
    expect(setters.updateIo).toHaveBeenCalledWith(io);
  });

  test("a session's end, reset or deletion updates its championship", () => {
    const event = { sessionId: 's1', championshipId: 'c1' };
    sessionService.emit('sessionFinished', event);
    sessionService.emit('sessionReset', event);
    sessionService.emit('sessionDeleted', event);
    expect(championshipService.onSessionFinished).toHaveBeenCalledWith('s1', 'c1');
    expect(championshipService.onStandingsChanged.mock.calls).toEqual([
      ['c1', 's1', 'session_reset'],
      ['c1', 's1', 'session_deleted'],
    ]);
  });
});
