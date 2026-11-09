import express from 'express';

/**
 * Add-on fields on core records — docs/ADDONS.md § Extra fields on core records.
 *
 * Each record type has an extension table holding one row per record and per add-on.
 * Everything here works on the calling add-on's rows only, so a mistake in one add-on
 * can never erase the fields of another.
 */

export const EXTRA_TYPES = {
  car: { model: 'carExtra', modelName: 'CarExtra', key: 'carId', label: 'Car' },
  driver: { model: 'driverExtra', modelName: 'DriverExtra', key: 'driverId', label: 'Driver' },
  track: { model: 'trackExtra', modelName: 'TrackExtra', key: 'trackId', label: 'Track' },
  team: { model: 'teamExtra', modelName: 'TeamExtra', key: 'teamId', label: 'Team' },
  session: { model: 'sessionExtra', modelName: 'SessionExtra', key: 'sessionId', label: 'Session' },
  championship: {
    model: 'championshipExtra',
    modelName: 'ChampionshipExtra',
    key: 'championshipId',
    label: 'Championship',
  },
};

const EXTRA_MODELS = new Map(Object.values(EXTRA_TYPES).map((type) => [type.modelName, type]));

export class ExtraError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ExtraError';
    this.status = status;
  }
}

function extraType(type) {
  const found = Object.hasOwn(EXTRA_TYPES, type) ? EXTRA_TYPES[type] : null;
  if (!found) {
    throw new ExtraError(`Unknown record type "${type}". Use one of: ${Object.keys(EXTRA_TYPES).join(', ')}`, 400);
  }
  return found;
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** Stored JSON, or {} when it is missing or damaged: a bad row must never break a page. */
export function parseExtra(data) {
  try {
    const value = JSON.parse(data);
    return isPlainObject(value) ? value : {};
  } catch {
    return {};
  }
}

const isForeignKeyError = (error) => /foreign key/i.test(`${error?.message} ${error?.cause?.message ?? ''}`);

/**
 * `ctx.extra` for one add-on.
 *
 * @param {import('@prisma/client').PrismaClient} prisma the core client (unscoped)
 * @param {string} addonId
 */
export function createExtras(prisma, addonId) {
  const extras = {
    /** This add-on's fields on a record, {} when it has none. */
    async get(type, recordId) {
      const { model, key } = extraType(type);
      const row = await prisma[model].findUnique({
        where: { [`${key}_addon`]: { [key]: recordId, addon: addonId } },
      });
      return row ? parseExtra(row.data) : {};
    },

    /**
     * Merge `fields` into this add-on's fields on a record (JSON merge patch:
     * nested objects are merged, `null` removes a field), in one atomic statement.
     *
     * @returns the add-on's fields after the merge
     */
    async set(type, recordId, fields) {
      const { modelName, key, label } = extraType(type);
      if (!isPlainObject(fields)) throw new ExtraError('Extra fields must be a JSON object', 400);
      const patch = JSON.stringify(fields);
      try {
        // Table and column names come from EXTRA_TYPES, never from the caller
        await prisma.$executeRawUnsafe(
          `INSERT INTO "${modelName}" ("${key}", "addon", "data", "updatedAt")
           VALUES (?, ?, json_patch('{}', ?), ?)
           ON CONFLICT ("${key}", "addon")
           DO UPDATE SET "data" = json_patch("data", ?), "updatedAt" = excluded."updatedAt"`,
          recordId,
          addonId,
          patch,
          Date.now(),
          // The raw patch again: excluded."data" has already lost its nulls
          patch
        );
      } catch (error) {
        if (isForeignKeyError(error)) throw new ExtraError(`${label} "${recordId}" not found`, 404);
        throw error;
      }
      return extras.get(type, recordId);
    },

    /** Delete this add-on's fields on a record. */
    async remove(type, recordId) {
      const { model, key } = extraType(type);
      await prisma[model].deleteMany({ where: { [key]: recordId, addon: addonId } });
    },

    /** This add-on's fields on every record of a type: { [recordId]: fields }. */
    async all(type) {
      const { model, key } = extraType(type);
      const rows = await prisma[model].findMany({ where: { addon: addonId } });
      return Object.fromEntries(rows.map((row) => [row[key], parseExtra(row.data)]));
    },
  };
  return extras;
}

/** Operations whose `where` is a filter, scoped with AND addon = <id>. */
const FILTER_OPERATIONS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'updateManyAndReturn',
  'deleteMany',
]);

/** Operations whose `where` is the unique key. */
const UNIQUE_OPERATIONS = new Set(['findUnique', 'findUniqueOrThrow', 'update', 'delete', 'upsert']);

/** Pure: the scoped arguments of an operation on an extension model. */
export function scopeExtraArgs(type, operation, args = {}, addonId) {
  const scoped = { ...args };
  const uniqueKey = `${type.key}_addon`;

  if (FILTER_OPERATIONS.has(operation)) {
    scoped.where = args.where ? { AND: [args.where, { addon: addonId }] } : { addon: addonId };
  }
  if (UNIQUE_OPERATIONS.has(operation)) {
    const where = { ...args.where };
    // A record id alone, or the compound key: either way, pinned to this add-on
    const recordId = where[uniqueKey]?.[type.key] ?? where[type.key];
    delete where[type.key];
    scoped.where = { ...where, [uniqueKey]: { [type.key]: recordId, addon: addonId } };
  }
  if (operation === 'create') scoped.data = { ...args.data, addon: addonId };
  if (operation === 'createMany' || operation === 'createManyAndReturn') {
    const rows = Array.isArray(args.data) ? args.data : [args.data];
    scoped.data = rows.map((row) => ({ ...row, addon: addonId }));
  }
  if (operation === 'upsert') {
    scoped.create = { ...args.create, addon: addonId };
    scoped.update = { ...args.update, addon: addonId };
  }
  if (operation === 'update' || operation === 'updateMany' || operation === 'updateManyAndReturn') {
    // Rows can't be handed over to another add-on
    scoped.data = { ...args.data, addon: addonId };
  }
  return scoped;
}

/**
 * The `ctx.prisma` given to an add-on: the core client, except that every query on an
 * extension table is limited to this add-on's rows. Raw SQL is not limited — see the guide.
 */
export function scopePrisma(prisma, addonId) {
  return prisma.$extends({
    name: `addon:${addonId}`,
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const type = EXTRA_MODELS.get(model);
          return query(type ? scopeExtraArgs(type, operation, args, addonId) : args);
        },
      },
    },
  });
}

/**
 * Adds `extras: { [addonId]: fields }` to records returned by the core API.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {keyof EXTRA_TYPES} type
 * @param {object|object[]|null} records
 */
export async function attachExtras(prisma, type, records) {
  if (!records) return records;
  const list = Array.isArray(records) ? records : [records];
  if (list.length === 0) return records;

  const { model, key } = extraType(type);
  const rows = await prisma[model].findMany({ where: { [key]: { in: list.map((record) => record.id) } } });
  const byRecord = new Map();
  for (const row of rows) {
    if (!byRecord.has(row[key])) byRecord.set(row[key], {});
    byRecord.get(row[key])[row.addon] = parseExtra(row.data);
  }

  const withExtras = list.map((record) => ({ ...record, extras: byRecord.get(record.id) ?? {} }));
  return Array.isArray(records) ? withExtras : withExtras[0];
}

/**
 * GET and PUT /extras/:type/:recordId, mounted on each add-on's router, so the web side
 * can read and write its fields: PUT /api/addons/<id>/extras/car/:carId.
 */
export function createExtrasRouter(extras) {
  const router = express.Router();

  const handle = (action) => async (req, res) => {
    try {
      res.json({ success: true, data: await action(req) });
    } catch (error) {
      const status = error instanceof ExtraError ? error.status : 500;
      res.status(status).json({ success: false, error: error.message });
    }
  };

  router.get(
    '/extras/:type/:recordId',
    handle((req) => extras.get(req.params.type, req.params.recordId))
  );
  router.put(
    '/extras/:type/:recordId',
    handle((req) => extras.set(req.params.type, req.params.recordId, req.body))
  );
  router.delete(
    '/extras/:type/:recordId',
    handle(async (req) => {
      await extras.remove(req.params.type, req.params.recordId);
      return {};
    })
  );
  return router;
}
