import { SessionType, SessionStatus, RUNNING_SESSION_STATUSES } from '@racehubos/shared';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { backupDatabase } from './backupDatabase.js';
import { importedStatus } from './cockpitMappers.js';

const field = (name, type = 'text', options = {}) => ({ name, type, ...options });
export const COCKPIT_FIELDS = {
  drivers: [
    field('name', 'text', { required: true }),
    field('email'),
    field('number', 'integer'),
    field('color', 'color'),
    field('img'),
  ],
  cars: [
    field('brand', 'text', { required: true }),
    field('model', 'text', { required: true }),
    field('year', 'integer'),
    field('color', 'color'),
    field('maxSpeed', 'integer', { min: 0, max: 100, required: true }),
    field('brakeForce', 'integer', { min: 0, max: 100, required: true }),
    field('fuelCapacity', 'integer', { min: 0, max: 100, required: true }),
    ...['motor', 'gearRatio', 'scale', 'tyresFront', 'tyresRear', 'notes', 'img'].map((name) => field(name)),
  ],
  tracks: [
    field('name', 'text', { required: true }),
    field('length', 'number', { min: 0 }),
    field('corners', 'integer', { min: 0 }),
    field('color', 'color'),
    field('img'),
  ],
  sessions: [
    field('name'),
    field('type', 'choice', { values: Object.values(SessionType), required: true }),
    field('track', 'reference', { group: 'tracks', required: true }),
    field('startedAt', 'date'),
    field('finishedAt', 'date'),
  ],
  results: [
    field('session', 'reference', { group: 'sessions', required: true }),
    field('driver', 'reference', { group: 'drivers', required: true }),
    field('car', 'reference', { group: 'cars', required: true }),
    field('controller', 'integer', { min: 0, max: 5, required: true }),
    field('finalPos', 'integer', { min: 1 }),
    field('totalLaps', 'integer', { min: 0, required: true }),
    field('totalTime', 'integer', { min: 0, required: true }),
    field('bestLapTime', 'integer', { min: 0 }),
    field('isDNF', 'boolean'),
  ],
  laps: [
    field('session', 'reference', { group: 'sessions', required: true }),
    field('driver', 'reference', { group: 'drivers', required: true }),
    field('car', 'reference', { group: 'cars', required: true }),
    field('controller', 'integer', { min: 0, max: 5, required: true }),
    field('lapNumber', 'integer', { min: 1, required: true }),
    field('lapTime', 'number', { min: 0.001, required: true }),
    field('timestamp', 'date'),
    ...['sector1', 'sector2', 'sector3'].map((name) => field(name, 'number', { min: 0 })),
  ],
};
const models = {
  drivers: 'driver',
  cars: 'car',
  tracks: 'track',
  sessions: 'session',
  results: 'sessionDriver',
  laps: 'lap',
};
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export async function targetSnapshot(prisma) {
  const signature = [];
  for (const model of Object.values(models)) {
    const rows = await prisma[model].findMany({ orderBy: { id: 'asc' } });
    signature.push([model, hash(rows)]);
  }
  signature.push(['imports', await prisma.cockpitImportRecord.findMany({ orderBy: { key: 'asc' } })]);
  return hash(signature);
}
export async function prepareCockpitPreview(prisma, rows) {
  const targets = {};
  const records = new Map((await prisma.cockpitImportRecord.findMany()).map((row) => [row.key, row]));
  for (const [group, model] of Object.entries(models)) {
    const existing = await prisma[model].findMany();
    targets[group] = existing
      .filter((row) => !row.deletedAt)
      .map((row) => ({ id: row.id, label: row.name || [row.brand, row.model].filter(Boolean).join(' ') || row.id }));
    for (const row of rows[group]) {
      const previous = records.get(row.key);
      const exact = ['drivers', 'cars', 'tracks'].includes(group)
        ? existing.filter(
            (item) =>
              !item.deletedAt &&
              (group === 'cars'
                ? item.model === row.data.model && item.brand === row.data.brand
                : item.name === row.data.name)
          )
        : [];
      row.lockedTarget = !!previous;
      row.targetId =
        previous && existing.some((item) => item.id === previous.targetId && !item.deletedAt)
          ? previous.targetId
          : exact.length === 1
            ? exact[0].id
            : '';
      if (previous && !row.targetId)
        throw new Error('Previously imported target is missing; restore or remove its import record before retrying');
    }
  }
  return { rows, targets, signature: await targetSnapshot(prisma) };
}
function validation(message) {
  throw Object.assign(new Error(message), { status: 400 });
}
export function validateCockpitRows(input, preview) {
  if (!input || typeof input !== 'object' || Object.keys(input).some((key) => !Object.hasOwn(models, key)))
    validation('Invalid import object groups');
  const selected = {};
  const keys = new Set();
  for (const group of Object.keys(models)) {
    if (!Array.isArray(input[group]) || input[group].length > 5000) validation('Invalid import row list');
    const source = new Map(preview.rows[group].map((row) => [row.key, row]));
    selected[group] = input[group].map((row) => {
      if (
        !row ||
        !source.has(row.key) ||
        keys.has(row.key) ||
        Object.keys(row).some((name) => !['key', 'targetId', 'data', 'includeImage'].includes(name))
      )
        validation('Invalid or duplicate import row');
      keys.add(row.key);
      if (source.get(row.key).lockedTarget && row.targetId !== source.get(row.key).targetId)
        validation('Previously imported targets cannot be remapped');
      if (
        typeof row.targetId !== 'string' ||
        (row.targetId && !preview.targets[group].some((item) => item.id === row.targetId))
      )
        validation('Unknown import target');
      if (row.includeImage !== undefined && typeof row.includeImage !== 'boolean')
        validation('Invalid image selection');
      if (
        !row.data ||
        typeof row.data !== 'object' ||
        Array.isArray(row.data) ||
        Object.keys(row.data).some((name) => !COCKPIT_FIELDS[group].some((field) => field.name === name))
      )
        validation('Unknown import field');
      const data = {};
      for (const item of COCKPIT_FIELDS[group]) {
        const value = row.data[item.name];
        if (value === null || value === undefined || value === '') {
          if (item.required && !row.targetId) validation('Missing field: ' + group + '.' + item.name);
          data[item.name] = null;
          continue;
        }
        if (item.type === 'boolean') {
          if (typeof value !== 'boolean') validation('Invalid boolean');
        } else if (['number', 'integer'].includes(item.type)) {
          if (
            typeof value !== 'number' ||
            !Number.isFinite(value) ||
            (item.type === 'integer' && !Number.isSafeInteger(value)) ||
            (item.min !== undefined && value < item.min) ||
            (item.max !== undefined && value > item.max)
          )
            validation('Invalid number: ' + item.name);
        } else if (typeof value !== 'string' || value.length > (item.name === 'notes' ? 12000 : 2000))
          validation('Invalid text: ' + item.name);
        if (item.type === 'choice' && !item.values.includes(value)) validation('Invalid choice');
        if (item.type === 'date' && !Number.isFinite(new Date(value).getTime())) validation('Invalid date');
        if (item.type === 'color' && !/^#[0-9a-f]{6}$/i.test(value)) validation('Invalid color');
        if (
          item.name === 'img' &&
          !/^\/api\/img\/(drivers|cars|tracks)\/[a-zA-Z0-9_-]+\.(png|jpe?g|gif|webp)$/.test(value)
        )
          validation('Images must be local uploaded files');
        data[item.name] = value;
      }
      return {
        key: row.key,
        targetId: row.targetId,
        data,
        image: row.includeImage === false ? null : source.get(row.key).image,
      };
    });
  }
  const byKey = Object.fromEntries(
    Object.entries(selected).map(([group, rows]) => [group, new Map(rows.map((row) => [row.key, row]))])
  );
  const slots = new Set();
  for (const [group, rows] of Object.entries(selected))
    for (const row of rows) {
      if (row.targetId) continue;
      for (const item of COCKPIT_FIELDS[group].filter((item) => item.type === 'reference'))
        if (!byKey[item.group].has(row.data[item.name])) validation('Unresolved reference: ' + group + '.' + item.name);
      if (group === 'results') {
        const slot = row.data.session + ':' + row.data.controller;
        if (slots.has(slot)) validation('Duplicate controller in imported session');
        slots.add(slot);
      }
      if (group === 'laps') {
        const matches = selected.results.filter(
          (result) =>
            result.data.session === row.data.session &&
            result.data.controller === row.data.controller &&
            result.data.driver === row.data.driver &&
            result.data.car === row.data.car
        );
        if (matches.length !== 1) validation('Lap must match exactly one reviewed session result');
      }
    }
  return selected;
}
export async function commitCockpitImport({ prisma, preview, rows, uploads, backup = backupDatabase }) {
  const selected = validateCockpitRows(rows, preview);
  if (!Object.values(selected).some((rows) => rows.length)) validation('No rows selected');
  if (await prisma.session.count({ where: { status: { in: RUNNING_SESSION_STATUSES } } }))
    validation('Finish active sessions before importing');
  if ((await targetSnapshot(prisma)) !== preview.signature)
    throw Object.assign(new Error('Import preview is stale'), { status: 409 });
  // The standard backup function must succeed before the first import file or record is written.
  const backupFile = await backup({ reason: 'cockpit-import-' + randomUUID().slice(0, 8) });
  if (!backupFile) throw new Error('Database backup failed');
  const written = [];
  try {
    const counts = await prisma.$transaction(
      async (tx) => {
        if ((await targetSnapshot(tx)) !== preview.signature)
          throw Object.assign(new Error('Import preview is stale'), { status: 409 });
        if (await tx.session.count({ where: { status: { in: RUNNING_SESSION_STATUSES } } }))
          validation('Finish active sessions before importing');
        const ids = new Map();
        const sessionTracks = new Map();
        const counts = {};
        for (const [group, model] of Object.entries(models)) {
          counts[group] = 0;
          for (const row of selected[group]) {
            const id = row.targetId || randomUUID();
            ids.set(row.key, id);
            if (row.targetId) {
              if (group === 'sessions')
                sessionTracks.set(id, (await tx.session.findUniqueOrThrow({ where: { id } })).trackId);
              // Existing entities are explicit links, never silently overwritten.
              await tx.cockpitImportRecord.upsert({
                where: { key: row.key },
                create: { key: row.key, sourceType: group, targetId: id },
                update: {},
              });
              continue;
            }
            const data = { ...row.data, id };
            if (row.image && ['drivers', 'cars', 'tracks'].includes(group)) {
              const fileName = 'cockpit-' + randomUUID() + row.image.extension;
              const target = path.join(uploads, group, fileName);
              await fs.mkdir(path.dirname(target), { recursive: true });
              await fs.writeFile(target, Buffer.from(row.image.data, 'base64'), { flag: 'wx' });
              written.push(target);
              data.img = `/api/img/${group}/${fileName}`;
            }
            if (group === 'sessions') {
              data.trackId = ids.get(data.track);
              delete data.track;
              data.status = importedStatus;
              if (data.startedAt) data.startedAt = new Date(data.startedAt);
              if (data.finishedAt) data.finishedAt = new Date(data.finishedAt);
              sessionTracks.set(id, data.trackId);
            }
            if (['results', 'laps'].includes(group)) {
              data.sessionId = ids.get(data.session);
              data.driverId = ids.get(data.driver);
              data.carId = ids.get(data.car);
              delete data.session;
              delete data.driver;
              delete data.car;
            }
            if (group === 'laps') {
              data.trackId = sessionTracks.get(data.sessionId);
              data.phase = SessionStatus.ACTIVE;
              if (data.timestamp) data.timestamp = new Date(data.timestamp);
              else delete data.timestamp;
            }
            await tx[model].create({ data });
            await tx.cockpitImportRecord.create({ data: { key: row.key, sourceType: group, targetId: id } });
            counts[group]++;
          }
        }
        return counts;
      },
      { timeout: 30000 }
    );
    return { counts, backupFile: path.basename(backupFile) };
  } catch (error) {
    await Promise.all(written.map((file) => fs.rm(file, { force: true })));
    throw error;
  }
}
