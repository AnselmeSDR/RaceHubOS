import { SessionType, SessionStatus } from '@racehubos/shared';
import { createHash } from 'node:crypto';

const text = (value) => (value == null ? '' : String(value).trim());
const number = (value, fallback = null) =>
  Number.isFinite(Number(value)) && value !== null && value !== '' && value !== undefined ? Number(value) : fallback;
const key = (group, row) =>
  createHash('sha256')
    .update(group + JSON.stringify(Object.fromEntries(Object.entries(row).sort(([a], [b]) => a.localeCompare(b)))))
    .digest('hex');
const normalize = (value) => text(value).normalize('NFC').toLowerCase();
const identity = (group, row) => ({ key: key(group, row), targetId: '', data: {} });
function image(raw, images) {
  return images[text(raw.Picture).replaceAll('\\', '/').split('/').pop().toLowerCase()] || null;
}
export function mapDriver(row, images) {
  return {
    ...identity('drivers', row),
    image: image(row, images),
    aliases: [text(row.Driver), text(row.FullName)],
    data: {
      name: text(row.Driver || row.FullName),
      color: text(row.Color) || '#3B82F6',
      email: text(row.Email) || null,
      number: number(row.Number),
      img: null,
    },
  };
}
export function mapCar(row, images, equipment) {
  const props = Object.fromEntries(
    equipment.filter((item) => item.CarName === row.Car).map((item) => [normalize(item.Property), text(item.Value)])
  );
  const ratio = props.ritzel && props.zahnrad ? `${props.ritzel}:${props.zahnrad}` : null;
  return {
    ...identity('cars', row),
    image: image(row, images),
    aliases: [text(row.Car), text(row.FullName)],
    data: {
      brand: text(row.Brand || row.Manufacturer),
      model: text(row.FullName || row.Car),
      color: text(row.Color) || '#3B82F6',
      year: number(row.Year),
      img: null,
      maxSpeed: number(row.MaxSpeed, 100),
      brakeForce: number(row.BrakeForce, 50),
      fuelCapacity: number(row.FuelCapacity, 100),
      motor: props.motor || null,
      gearRatio: ratio,
      scale: props['maßstab'] || props.scale || null,
      tyresFront: props['reifen vorne'] || null,
      tyresRear: props['reifen hinten'] || null,
      notes: text(row.Notes) || null,
    },
  };
}
export function mapTrack(row, images) {
  return {
    ...identity('tracks', row),
    image: image(row, images),
    aliases: [text(row.Course), text(row.FullName)],
    data: {
      name: text(row.FullName || row.Course),
      length: number(row.Length),
      corners: number(row.Corners),
      color: text(row.Color) || '#9333ea',
      img: null,
    },
  };
}
function lookup(rows, name) {
  const matches = rows.filter((row) => row.aliases.some((alias) => alias && normalize(alias) === normalize(name)));
  return matches.length === 1 ? matches[0].key : '';
}
function dateValue(row) {
  const raw = text(row.Datum || row.Date);
  const date = /^\d{8}$/.test(raw) ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : raw;
  const time = text(row.Uhrzeit);
  const iso = new Date(date + (time ? 'T' + time : ''));
  return Number.isFinite(iso.getTime()) ? iso.toISOString() : null;
}
export function mapSessions(raw, rows) {
  const sessions = [];
  const results = [];
  const groups = new Map();
  for (const row of raw) {
    if (!text(row.Fahrer) || !text(row.Fahrzeug)) continue;
    const track = lookup(rows.tracks, row.RennStrecke);
    const grouping = text(row.MasterID)
      ? ['master', row.MasterID, row.RennStrecke, row.Datum, row.Uhrzeit, row.RennArt]
      : text(row.Uhrzeit)
        ? ['time', row.Datum, row.Uhrzeit, row.RennStrecke, row.RennArt]
        : ['result', row.ID];
    const group = JSON.stringify(grouping);
    let session = groups.get(group);
    if (!session) {
      session = {
        ...identity('sessions', { group }),
        data: {
          name: text(row.RennArt) || 'Cockpit-XP',
          type: SessionType.RACE,
          track,
          startedAt: dateValue(row),
          finishedAt: dateValue(row),
        },
        sourceGroup: text(row.MasterID),
        sourceDate: text(row.Datum || row.Date),
      };
      groups.set(group, session);
      sessions.push(session);
    }
    results.push({
      ...identity('results', row),
      data: {
        session: session.key,
        driver: lookup(rows.drivers, row.Fahrer),
        car: lookup(rows.cars, row.Fahrzeug),
        controller: groups.get(group).controllers || 0,
        finalPos: number(row.Platz),
        totalLaps: number(row.Runden, 0),
        totalTime: number(row.Gesamtzeit, 0),
        bestLapTime: number(row.BesteRunde),
        isDNF: false,
      },
    });
    session.controllers = (session.controllers || 0) + 1;
  }
  return { sessions, results };
}
export function mapLaps(raw, rows) {
  const counts = new Map();
  return raw
    .filter((row) => number(row.RoundTime) > 0)
    .map((row) => {
      const driver = lookup(rows.drivers, row.Driver);
      const car = lookup(rows.cars, row.Car);
      const track = lookup(rows.tracks, row.Course);
      const matches = rows.results.filter(
        (result) =>
          result.data.driver === driver &&
          result.data.car === car &&
          rows.sessions.some(
            (session) =>
              session.key === result.data.session &&
              session.data.track === track &&
              (row.MasterID
                ? session.sourceGroup === text(row.MasterID)
                : row.Date
                  ? session.sourceDate === text(row.Date)
                  : true)
          )
      );
      const result = matches.length === 1 ? matches[0] : null;
      const session = result?.data.session || '';
      const counter = session + ':' + driver + ':' + car;
      const lapNumber = (counts.get(counter) || 0) + 1;
      counts.set(counter, lapNumber);
      return {
        ...identity('laps', row),
        data: {
          session,
          driver,
          car,
          controller: result?.data.controller ?? 0,
          lapNumber,
          lapTime: number(row.RoundTime),
          timestamp: dateValue(row),
          sector1: number(row.Sector1),
          sector2: number(row.Sector2),
          sector3: number(row.Sector3),
        },
      };
    });
}
export function mapCockpitArchive(raw) {
  const rows = {
    drivers: raw.DriverItems.map((row) => mapDriver(row, raw.images)),
    cars: raw.CarItems.map((row) => mapCar(row, raw.images, raw.CarData)),
    tracks: raw.CourseItems.map((row) => mapTrack(row, raw.images)),
  };
  Object.assign(rows, mapSessions(raw.StRennResults || [], rows));
  rows.laps = mapLaps(raw.StRoundTime || [], rows);
  return rows;
}
export const importedStatus = SessionStatus.FINISHED;
