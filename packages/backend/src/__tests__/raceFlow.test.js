import { jest } from '@jest/globals';
import { SessionService } from '../services/SessionService.js';
import { SessionStatus, SessionType } from '@racehubos/shared';

/**
 * Le déroulé d'une course, du drapeau à damier au classement.
 *
 * La règle : à la fin du temps, chacun termine le tour en cours. Ce tour-là
 * compte et la vitesse est aussitôt réduite ; tout passage suivant est ignoré.
 * Qui n'a pas franchi la ligne avant la fin de la grâce est DNF.
 *
 * Treize engagements de qualification portaient un DNF alors qu'ils étaient
 * classés, d'où ces tests sur le chemin complet plutôt que sur handleLap seul.
 */
describe('déroulé de course', () => {
  let service;
  let setSpeed;

  const driver = (controller, laps) => ({
    id: `sd-${controller}`,
    controller,
    driverId: `driver-${controller}`,
    carId: `car-${controller}`,
    driver: { name: `Pilote ${controller}` },
    car: { brand: 'Carrera', model: 'Voiture' },
    totalLaps: laps,
    totalTime: laps * 12_000,
    bestLapTime: 11_500,
    lastLapTime: 12_000,
    lapsAtFinishing: null,
    crossings: laps,
    isDNF: false,
  });

  const passage = (controller, lapTime = 10_000) =>
    service.handleLap({ controller, lapTime, sector: 1 });

  /** Fige lapsAtFinishing comme le fait startFinishingPhase. */
  const drapeau = () => {
    service.sessionStatus = SessionStatus.FINISHING;
    for (const d of service.sessionDrivers) d.lapsAtFinishing = d.totalLaps;
  };

  beforeEach(() => {
    setSpeed = jest.fn().mockResolvedValue(undefined);
    service = new SessionService({ emit: jest.fn() });
    service.activeSessionId = 'session-1';
    service.activeTrackId = 'track-1';
    service.currentPhase = SessionType.RACE;
    service.sessionStatus = SessionStatus.ACTIVE;
    service.sessionConfig = { maxLaps: null, gracePeriod: 30_000 };
    service.sessionDrivers = [driver(1, 10), driver(2, 9)];
    service.syncService = { getDevice: () => ({ setSpeed }) };

    service.saveLap = jest.fn();
    service.updateSessionDriver = jest.fn();
    service.emitLeaderboard = jest.fn();
    service.recalculatePositions = jest.fn();
    service.checkSessionComplete = jest.fn();
  });

  afterEach(async () => {
    await service.prisma.$disconnect();
  });

  describe('pendant la course', () => {
    it('compte les tours et ne touche pas à la vitesse', async () => {
      await passage(1);

      expect(service.sessionDrivers[0].totalLaps).toBe(11);
      expect(setSpeed).not.toHaveBeenCalled();
    });
  });

  describe('pendant la période de grâce', () => {
    it('compte le tour en cours et réduit aussitôt la vitesse', async () => {
      drapeau();

      await passage(1);

      expect(service.sessionDrivers[0].totalLaps).toBe(11);
      expect(service.saveLap).toHaveBeenCalledTimes(1);
      expect(setSpeed).toHaveBeenCalledWith(1, 1);
      expect(service.sessionDrivers[0]._throttled).toBe(true);
    });

    it('ignore les passages suivants du même pilote', async () => {
      drapeau();
      await passage(1);
      service.saveLap.mockClear();

      await passage(1);
      await passage(1);

      expect(service.sessionDrivers[0].totalLaps).toBe(11);
      expect(service.saveLap).not.toHaveBeenCalled();
    });

    it('ne ralentit pas celui qui n\'a pas encore fini son tour', async () => {
      drapeau();

      await passage(1);

      // Le second n'a pas franchi la ligne : il court toujours
      expect(setSpeed).toHaveBeenCalledTimes(1);
      expect(service.sessionDrivers[1]._throttled).toBeUndefined();
    });

    it('ne réduit la vitesse qu\'une fois', async () => {
      drapeau();

      await passage(1);
      await passage(1);

      expect(setSpeed).toHaveBeenCalledTimes(1);
    });
  });

  describe('classement à la fin de la grâce', () => {
    const dnfApres = async (passages) => {
      drapeau();
      for (const c of passages) await passage(c);

      service.prisma = {
        sessionDriver: {
          findUnique: jest.fn(({ where }) => Promise.resolve({
            lapsAtFinishing: service.sessionDrivers.find((d) => d.id === where.id).lapsAtFinishing,
          })),
          update: jest.fn().mockResolvedValue({}),
        },
        $disconnect: jest.fn(),
      };
      await service.calculateDNF();
      return service.sessionDrivers.map((d) => d.isDNF === true);
    };

    it('classe qui a franchi la ligne, marque DNF qui ne l\'a pas fait', async () => {
      expect(await dnfApres([1])).toEqual([false, true]);
    });

    it('ne marque personne quand tous ont franchi la ligne', async () => {
      expect(await dnfApres([1, 2])).toEqual([false, false]);
    });

    it('marque tout le monde quand personne ne l\'a franchie', async () => {
      expect(await dnfApres([])).toEqual([true, true]);
    });
  });

  describe('course au nombre de tours', () => {
    beforeEach(() => {
      service.sessionConfig.maxLaps = 11;
    });

    it('ralentit dès la limite atteinte, sans attendre le drapeau', async () => {
      await passage(1);

      expect(service.sessionDrivers[0].totalLaps).toBe(11);
      expect(setSpeed).toHaveBeenCalledWith(1, 1);
    });

    it('ignore les passages au-delà de la limite', async () => {
      await passage(1);
      service.saveLap.mockClear();

      await passage(1);

      expect(service.sessionDrivers[0].totalLaps).toBe(11);
      expect(service.saveLap).not.toHaveBeenCalled();
    });

    it('marque DNF qui n\'a pas atteint la limite', async () => {
      drapeau();
      service.prisma = {
        sessionDriver: {
          findUnique: jest.fn().mockResolvedValue({ lapsAtFinishing: 10 }),
          update: jest.fn().mockResolvedValue({}),
        },
        $disconnect: jest.fn(),
      };

      await service.calculateDNF();

      // 10 et 9 tours pour une limite à 11
      expect(service.sessionDrivers.map((d) => d.isDNF === true)).toEqual([true, true]);
    });
  });

  describe('une fois la session terminée', () => {
    it('ignore tout passage tardif', async () => {
      service.sessionStatus = SessionStatus.FINISHED;

      await passage(1);

      expect(service.sessionDrivers[0].totalLaps).toBe(10);
      expect(service.saveLap).not.toHaveBeenCalled();
    });
  });

  describe('sans Control Unit', () => {
    it('compte le tour même si la vitesse ne peut pas être réduite', async () => {
      service.syncService = { getDevice: () => null };
      drapeau();

      await passage(1);

      expect(service.sessionDrivers[0].totalLaps).toBe(11);
      expect(service.sessionDrivers[0]._throttled).toBeUndefined();
    });
  });
});
