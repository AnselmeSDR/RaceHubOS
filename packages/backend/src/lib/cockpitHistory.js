import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const COCKPIT_ARCHIVE_KEY = 'cockpit:archive:v1';
const norm = (text) =>
  String(text || '')
    .normalize('NFC')
    .trim()
    .toLocaleLowerCase('de');
const stable = (value) =>
  Array.isArray(value)
    ? value.map(stable)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, stable(value[key])])
        )
      : value;
const hash = (value) =>
  createHash('sha256')
    .update(JSON.stringify(stable(value)))
    .digest('hex');
const text = (value) => (typeof value === 'string' ? value.trim().slice(0, 2000) : '');
const integer = (value) => (Number.isSafeInteger(value) && value >= 0 ? value : null);
export function readCockpitArchive(db) {
  const value = db.prepare('SELECT value FROM Preference WHERE key=?').get(COCKPIT_ARCHIVE_KEY)?.value;
  return value ? JSON.parse(value) : { version: 1, cars: [], records: [], mappings: [] };
}
export function saveCockpitArchive(db, archive) {
  const encoded = JSON.stringify(archive);
  if (Buffer.byteLength(encoded) > 5 * 1024 * 1024)
    throw new Error('Cockpit-XP-Historie ist zu groß. Maximal 5 MB historische Daten pro RaceHubOS-Datenbestand.');
  db.prepare(
    'INSERT INTO Preference (key,value,updatedAt) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updatedAt=excluded.updatedAt'
  ).run(COCKPIT_ARCHIVE_KEY, encoded, Date.now());
}
// Exact names and the explicit original-name marker from our previous import only.
// No brand, substring, spelling similarity or H/C prefix guessing.
export function resolveCockpitEntities(db, data, additions, previous, uploads) {
  const result = {},
    mappings = [],
    unresolved = [];
  for (const [group, table, field] of [
    ['drivers', 'Driver', 'name'],
    ['cars', 'Car', 'model'],
    ['tracks', 'Track', 'name'],
  ]) {
    const current = db.prepare(`SELECT * FROM ${table} WHERE deletedAt IS NULL`).all();
    const source = data[group] || [];
    const byAlias = new Map(),
      bySource = new Map();
    for (const item of source) {
      const aliases = [
        ...new Set([item[field], ...(item.aliases || [])].filter((a) => typeof a === 'string' && a.trim()).map(norm)),
      ];
      const original = group === 'cars' ? norm(item.aliases?.[0] || item.model) : null;
      const provenance = current.filter(
        (row) =>
          group === 'cars' &&
          String(row.notes || '')
            .split(/\r?\n/)
            .some((line) => norm(line) === norm('Aus Cockpit-XP übernommen. Ursprüngliche Bezeichnung: ' + original))
      );
      const stored = previous.mappings.filter(
        (m) => m.group === group && m.sourceId === String(item.sourceId) && m.identity === aliases.join('|')
      );
      const storedRows = current.filter((row) => stored.some((m) => m.id === row.id));
      const exact = current.filter(
        (row) =>
          aliases.includes(norm(row[field])) &&
          source.filter((other) => [other[field], ...(other.aliases || [])].some((a) => norm(a) === norm(row[field])))
            .length === 1
      );
      const images =
        uploads && item.image
          ? current.filter((row) => {
              const match = /^\/api\/img\/(drivers|cars|tracks)\/([a-zA-Z0-9_. -]+)$/.exec(row.img || '');
              if (!match || match[1] !== group || match[2].includes('..')) return false;
              const file = path.join(uploads, group, match[2]);
              return (
                fs.existsSync(file) &&
                createHash('sha256').update(fs.readFileSync(file)).digest('hex') ===
                  createHash('sha256').update(Buffer.from(item.image.data, 'base64')).digest('hex')
              );
            })
          : [];
      const candidates = new Map([...provenance, ...storedRows, ...images, ...exact].map((row) => [row.id, row]));
      let id = candidates.size === 1 ? candidates.keys().next().value : null;
      const added = additions[group].find((a) => a.sourceId === String(item.sourceId));
      if (!id && candidates.size === 0 && added) id = added.id;
      if (id) mappings.push({ group, sourceId: String(item.sourceId), identity: aliases.join('|'), id });
      else
        unresolved.push({
          kind: group,
          sourceId: String(item.sourceId),
          name: item[field],
          reason: candidates.size > 1 ? 'ambiguous' : 'unmatched',
        });
      bySource.set(String(item.sourceId), id);
      for (const alias of aliases) {
        if (!byAlias.has(alias)) byAlias.set(alias, new Set());
        byAlias.get(alias).add(id); // An unresolved namesake also makes an alias unsafe.
      }
    }
    // A target must never represent two distinct source entities, even if photos match.
    const owners = new Map();
    for (const [sourceId, id] of bySource)
      if (id) {
        if (!owners.has(id)) owners.set(id, []);
        owners.get(id).push(sourceId);
      }
    for (const [id, sourceIds] of owners)
      if (sourceIds.length > 1) {
        for (const sourceId of sourceIds) {
          bySource.set(sourceId, null);
          unresolved.push({
            kind: group,
            sourceId,
            name: source.find((row) => String(row.sourceId) === sourceId)?.[field],
            reason: 'ambiguous',
          });
        }
        for (const values of byAlias.values()) if (values.delete(id)) values.add(null);
        for (let i = mappings.length - 1; i >= 0; i--)
          if (mappings[i].group === group && mappings[i].id === id) mappings.splice(i, 1);
      }
    result[group] = {
      bySource,
      get(name) {
        const values = byAlias.get(norm(name));
        return values?.size === 1 ? [...values][0] : null;
      },
    };
  }
  return { entities: result, mappings, unresolved };
}
export function planCockpitHistory(db, data, additions, options = {}, uploads) {
  const previous = readCockpitArchive(db);
  const { entities, mappings, unresolved } = resolveCockpitEntities(db, data, additions, previous, uploads);
  const cars = [],
    records = [],
    issues = [...unresolved],
    seen = new Set(previous.records.map((r) => r.key));
  const previousCars = new Map(previous.cars.map((r) => [r.carId, r]));
  let duplicates = 0,
    empty = 0;
  if (options.technology !== false || options.maintenance !== false)
    for (const car of data.cars) {
      const carId = entities.cars.bySource.get(String(car.sourceId));
      if (!carId) continue;
      const old = previousCars.get(carId) || {};
      const technology =
        options.technology === false
          ? old.technology || {}
          : Object.fromEntries(
              Object.entries(car.technology || {})
                .filter(([k, v]) => text(k) && text(v))
                .map(([k, v]) => [text(k), text(v)])
            );
      const service = options.maintenance === false ? old.service || null : car.service || null;
      const row = {
        carId,
        sourceId: String(car.sourceId),
        sourceName: text(car.aliases?.[0] || car.model),
        technology,
        service,
        inUseSince: text(car.inUseSince),
      };
      if (Object.keys(technology).length || service) {
        if (
          hash(row) !==
          hash(Object.fromEntries(Object.entries(old).filter(([k]) => !['importedAt', 'source'].includes(k))))
        )
          cars.push(row);
      }
    }
  if (options.history !== false) {
    for (const [table, rows] of Object.entries(data.history || {})) {
      if (
        !['StRennResults', 'StMoreRecords', 'StRoundTime', 'StRennCounter', 'StWinnerItems'].includes(table) ||
        !Array.isArray(rows) ||
        rows.length > 50000
      )
        throw new Error('Ungültige historische Statistikliste.');
      for (const raw of rows) {
        if (
          !raw ||
          typeof raw !== 'object' ||
          Object.keys(raw).length > 30 ||
          Object.values(raw).some(
            (v) => v !== null && typeof v !== 'string' && !(typeof v === 'number' && Number.isFinite(v))
          ) ||
          Object.values(raw).some((v) => typeof v === 'string' && v.length > 2000)
        )
          throw new Error('Ungültiger historischer Datenwert.');
        const numericFields = [
          'Runden',
          'Gesamtzeit',
          'BesteRunde',
          'Platz',
          'Recordtime',
          'Sector',
          'TopSpeedSector',
          'TopSpeedValue',
          'RoundTime',
          'Slot',
          'Totaltime',
          'Totaldistance',
          'Totalround',
          'AnzahlRennen',
          'AnzahlSiege',
        ];
        if (
          numericFields.some(
            (field) =>
              raw[field] !== undefined &&
              raw[field] !== null &&
              !(field === 'BesteRunde' && raw[field] === -1) &&
              integer(raw[field]) === null
          )
        ) {
          issues.push({ kind: table, sourceId: String(raw.ID), reason: 'invalid-value' });
          continue;
        }
        const isResult = table === 'StRennResults',
          isCounter = table === 'StRennCounter',
          isWinner = table === 'StWinnerItems';
        // Keep the original numeric units for counters/service. Do not infer seconds/metres.
        const driverName = isResult
          ? raw.Fahrer
          : isCounter
            ? raw.Typid === 0
              ? raw.Name
              : ''
            : isWinner
              ? raw.TypID === 0
                ? raw.Name
                : ''
              : raw.Driver;
        const carName = isResult
          ? raw.Fahrzeug
          : isCounter
            ? raw.Typid === 1
              ? raw.Name
              : ''
            : isWinner
              ? raw.TypID === 1
                ? raw.Name
                : ''
              : raw.Car;
        const trackName = isResult ? raw.RennStrecke : raw.Course;
        if (
          (isResult &&
            (!driverName || integer(raw.Runden) === null || integer(raw.Platz) === null || raw.RennArt === -1)) ||
          (!driverName && !carName)
        ) {
          empty++;
          continue;
        }
        if ((isCounter && ![0, 1].includes(raw.Typid)) || (isWinner && ![0, 1].includes(raw.TypID))) {
          issues.push({ kind: table, sourceId: String(raw.ID), reason: 'unsupported-type' });
          continue;
        }
        const driverId = driverName ? entities.drivers.get(driverName) : null;
        const carId = carName ? entities.cars.get(carName) : null;
        const trackId = trackName ? entities.tracks.get(trackName) : null;
        if ((driverName && !driverId) || (carName && !carId) || (trackName && !trackId)) {
          issues.push({
            kind: table,
            sourceId: String(raw.ID),
            name: [driverName, carName, trackName].filter(Boolean).join(' · '),
            reason: 'unmatched',
          });
          continue;
        }
        // Preserve raw sector codes; their meaning is not inferred as a full lap.
        const key = hash([table, raw]);
        if (seen.has(key)) {
          duplicates++;
          continue;
        }
        seen.add(key);
        records.push({
          key,
          kind: table,
          sourceId: String(raw.ID),
          driverId,
          carId,
          trackId,
          driverName: text(driverName),
          carName: text(carName),
          trackName: text(trackName),
          raw,
        });
      }
    }
  }
  return { cars, records, mappings, issues, duplicates, empty };
}
export function applyCockpitHistory(db, plan, source) {
  const previous = readCockpitArchive(db),
    now = new Date().toISOString();
  const cars = new Map(previous.cars.map((row) => [row.carId, row]));
  for (const row of plan.cars) {
    cars.set(row.carId, { ...row, source, importedAt: now });
    // Populate empty factual fields only. Never change a current setup or infer tyre fit.
    const motor = text(row.technology.Motor);
    if (motor)
      db.prepare("UPDATE Car SET motor=?,updatedAt=? WHERE id=? AND (motor IS NULL OR trim(motor)='')").run(
        motor,
        Date.now(),
        row.carId
      );
    const pinion = text(row.technology.Ritzel),
      gear = text(row.technology.Zahnrad);
    if (pinion && gear)
      db.prepare("UPDATE Car SET gearRatio=?,updatedAt=? WHERE id=? AND (gearRatio IS NULL OR trim(gearRatio)='')").run(
        `${pinion} / ${gear}`,
        Date.now(),
        row.carId
      );
  }
  const records = new Map(previous.records.map((row) => [row.key, row]));
  for (const row of plan.records) if (!records.has(row.key)) records.set(row.key, { ...row, source, importedAt: now });
  const mappings = new Map(previous.mappings.map((row) => [hash([row.group, row.sourceId, row.identity]), row]));
  for (const row of plan.mappings) mappings.set(hash([row.group, row.sourceId, row.identity]), row);
  saveCockpitArchive(db, {
    version: 1,
    source,
    importedAt: now,
    cars: [...cars.values()],
    records: [...records.values()],
    mappings: [...mappings.values()],
    lastImport: { issues: plan.issues, duplicates: plan.duplicates, empty: plan.empty },
  });
}
