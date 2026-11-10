import { CarreraSimulator } from '../services/simulator.js';
import { SyncService } from '../services/SyncService.js';
import { ControlUnit } from '../services/controlUnit.js';
import { SessionService } from '../services/SessionService.js';
import { ConfigService } from '../services/ConfigService.js';
import { ChampionshipService } from '../services/ChampionshipService.js';
import { setChampionshipService } from '../routes/championships.js';
import { setSettingsIo } from '../routes/settings.js';
import { setControlUnit, setSimulator, setSyncService } from '../routes/bluetooth.js';
import { setSessionService } from '../routes/sessions.js';
import { setConfigService } from '../routes/config.js';
import { setUpdateIo } from '../routes/update.js';

/**
 * The running services, wired to each other and handed to the routes that use them. Both devices
 * always exist: the user chooses which one to connect.
 */
export function createServices(io) {
  const sessionService = new SessionService(io);
  const configService = new ConfigService(io);
  const championshipService = new ChampionshipService(io);
  const controlUnit = new ControlUnit();
  const simulator = new CarreraSimulator(io);
  const syncService = new SyncService(io);

  syncService.setSessionService(sessionService);
  sessionService.setSyncService(syncService);
  championshipService.setSessionService(sessionService);

  // A session's end, reset or deletion changes its championship's standings
  sessionService.on('sessionFinished', async ({ sessionId, championshipId }) => {
    await championshipService.onSessionFinished(sessionId, championshipId);
  });
  sessionService.on('sessionReset', async ({ sessionId, championshipId }) => {
    await championshipService.onStandingsChanged(championshipId, sessionId, 'session_reset');
  });
  sessionService.on('sessionDeleted', async ({ sessionId, championshipId }) => {
    await championshipService.onStandingsChanged(championshipId, sessionId, 'session_deleted');
  });

  setControlUnit(controlUnit);
  setSimulator(simulator);
  setSyncService(syncService);
  setSettingsIo(io);
  setUpdateIo(io);
  setSessionService(sessionService);
  setChampionshipService(championshipService);
  setConfigService(configService);

  return { sessionService, configService, championshipService, controlUnit, simulator, syncService };
}
