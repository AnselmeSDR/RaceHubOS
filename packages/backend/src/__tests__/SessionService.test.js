import { jest } from '@jest/globals';
import { SessionService } from '../services/SessionService.js';

describe('SessionService.handleLap', () => {
  let service;

  beforeEach(() => {
    service = new SessionService({ emit: jest.fn() });
    service.activeSessionId = 'session-1';
    service.activeTrackId = 'track-1';
    service.currentPhase = 'race';
    service.sessionStatus = 'finishing';
    service.sessionConfig = {
      maxLaps: 10,
      gracePeriod: 30_000,
    };

    service.sessionDrivers = [
      {
        id: 'session-driver-1',
        controller: 1,
        driverId: 'driver-1',
        carId: 'car-1',
        driver: { name: 'Leader' },
        car: { brand: 'Carrera', model: 'Leader car' },
        totalLaps: 10,
        totalTime: 120_000,
        bestLapTime: 11_500,
        lastLapTime: 12_000,
        lapsAtFinishing: 10,
        crossings: 10,
        _throttled: true,
      },
      {
        id: 'session-driver-2',
        controller: 2,
        driverId: 'driver-2',
        carId: 'car-2',
        driver: { name: 'Second' },
        car: { brand: 'Carrera', model: 'Second car' },
        totalLaps: 9,
        totalTime: 110_000,
        bestLapTime: 11_800,
        lastLapTime: 12_300,
        lapsAtFinishing: 9,
        crossings: 9,
      },
    ];

    service.saveLap = jest.fn();
    service.updateSessionDriver = jest.fn();
    service.emitLeaderboard = jest.fn();
    service.recalculatePositions = jest.fn();
    service.throttleIfFinished = jest.fn();
    service.checkSessionComplete = jest.fn();
  });

  afterEach(async () => {
    await service.prisma.$disconnect();
  });

  async function expectNextPassageToBeIgnored(finishedDriver) {
    const stateAtFinish = {
      totalLaps: finishedDriver.totalLaps,
      totalTime: finishedDriver.totalTime,
      bestLapTime: finishedDriver.bestLapTime,
      lastLapTime: finishedDriver.lastLapTime,
      crossings: finishedDriver.crossings,
    };

    await service.handleLap({
      controller: finishedDriver.controller,
      lapTime: 10_000,
      sector: 1,
    });

    expect(finishedDriver).toMatchObject(stateAtFinish);
    expect(service.saveLap).not.toHaveBeenCalled();
    expect(service.updateSessionDriver).not.toHaveBeenCalled();
    expect(service.emitLeaderboard).not.toHaveBeenCalled();
  }

  test.each([
    ['course libre', 'practice'],
    ['qualification', 'qualif'],
    ['course', 'race'],
    ['équilibrage', 'balancing'],
  ])('ignore un tour au-delà de la limite en %s', async (_label, phase) => {
    service.currentPhase = phase;

    await expectNextPassageToBeIgnored(service.sessionDrivers[0]);
  });

  test.each([
    ['course libre', 'practice'],
    ['qualification', 'qualif'],
    ['course', 'race'],
  ])('autorise un dernier tour au temps puis ignore le suivant en %s', async (_label, phase) => {
    const driver = service.sessionDrivers[0];
    service.currentPhase = phase;
    service.sessionConfig.maxLaps = null;
    driver.totalLaps = 10;
    driver.lapsAtFinishing = 10;

    await service.handleLap({
      controller: driver.controller,
      lapTime: 10_000,
      sector: 1,
    });

    expect(driver.totalLaps).toBe(11);
    expect(service.saveLap).toHaveBeenCalledTimes(1);
    expect(service.updateSessionDriver).toHaveBeenCalledTimes(1);
    expect(service.emitLeaderboard).toHaveBeenCalledTimes(1);

    await service.handleLap({
      controller: driver.controller,
      lapTime: 9_500,
      sector: 1,
    });

    expect(driver.totalLaps).toBe(11);
    expect(service.saveLap).toHaveBeenCalledTimes(1);
    expect(service.updateSessionDriver).toHaveBeenCalledTimes(1);
    expect(service.emitLeaderboard).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['course libre', 'practice'],
    ['qualification', 'qualif'],
    ['course', 'race'],
    ['équilibrage', 'balancing'],
  ])('ignore tout passage reçu après la fin complète en %s', async (_label, phase) => {
    const driver = service.sessionDrivers[0];
    service.currentPhase = phase;
    service.sessionStatus = 'finished';
    driver.totalLaps = 5;

    await expectNextPassageToBeIgnored(driver);
  });
});
