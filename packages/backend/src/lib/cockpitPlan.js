import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { planCockpitHistory } from './cockpitHistory.js';

export function cockpitPlan(databasePath, uploads, data, options = {}) {
  if (data?.format !== 'RaceHubOS-Cockpit-Import' || ![1, 2].includes(data.version))
    throw new Error('Kein unterstütztes Cockpit-XP-Übernahmepaket.');
  const db = new Database(databasePath, { readonly: true });
  const result = {
    drivers: [],
    cars: [],
    tracks: [],
    skipped: 0,
    inactive: 0,
    source: String(data.source || 'Cockpit-XP').slice(0, 200),
    notes: data.notes || [],
  };
  let imageBytes = 0;
  try {
    // Validate all inputs even when not selected. Mapping also uses existing entities.
    for (const [group, table, field] of [
      ['drivers', 'Driver', 'name'],
      ['cars', 'Car', 'model'],
      ['tracks', 'Track', 'name'],
    ]) {
      if (!Array.isArray(data[group]) || data[group].length > 5000) throw new Error('Ungültige Stammdatenliste.');
      const known = new Set(
        db
          .prepare(`SELECT ${field} AS name FROM ${table}`)
          .all()
          .map((r) => r.name.trim().toLocaleLowerCase('de'))
      );
      for (const item of data[group]) {
        if (
          !item ||
          typeof item !== 'object' ||
          (item.aliases && (!Array.isArray(item.aliases) || item.aliases.length > 10))
        )
          throw new Error('Ungültige Quelldaten.');
        if (
          item.technology &&
          (typeof item.technology !== 'object' ||
            Object.entries(item.technology).length > 100 ||
            Object.entries(item.technology).some(
              ([k, v]) => typeof v !== 'string' || v.length > 2000 || k.length > 200
            ))
        )
          throw new Error('Ungültige Fahrzeugtechnik.');
        if (
          item.service &&
          (typeof item.service !== 'object' ||
            typeof item.service.active !== 'boolean' ||
            !item.service.values ||
            Object.entries(item.service.values).length > 50 ||
            Object.values(item.service.values).some((v) => typeof v !== 'string' || v.length > 200))
        )
          throw new Error('Ungültige Wartungsdaten.');
        if (item.image) {
          const { extension, data: encoded } = item.image;
          if (
            !['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(extension) ||
            typeof encoded !== 'string' ||
            !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)
          )
            throw new Error('Ungültige Bilddatei in Übernahmepaket.');
          const bytes = Buffer.from(encoded, 'base64').length;
          imageBytes += bytes;
          if (bytes > 5000000 || imageBytes > 25000000) throw new Error('Bilddateien zu groß.');
        }
        if (!options.includeInactive && !item.active) {
          result.inactive++;
          continue;
        }
        if (options[group] === false) continue;
        const name = typeof item[field] === 'string' ? item[field].trim().slice(0, 200) : '';
        if (!name) continue;
        if (known.has(name.toLocaleLowerCase('de'))) {
          result.skipped++;
          continue;
        }
        known.add(name.toLocaleLowerCase('de'));
        result[group].push({
          id: randomUUID(),
          name,
          brand: typeof item.brand === 'string' ? item.brand.slice(0, 100) : 'Carrera',
          notes: String(item.notes || '').slice(0, 12000),
          sourceId: String(item.sourceId || '').slice(0, 100),
          image: item.image,
        });
      }
    }
    // Remove proposed duplicates already identified by original name, stored mapping or exact image.
    const preliminary = planCockpitHistory(db, data, result, { ...options, history: false }, uploads);
    for (const group of ['drivers', 'cars', 'tracks'])
      result[group] = result[group].filter(
        (item) =>
          !preliminary.mappings.some((m) => m.group === group && m.sourceId === item.sourceId && m.id !== item.id) &&
          !preliminary.issues.some((m) => m.kind === group && m.sourceId === item.sourceId && m.reason === 'ambiguous')
      );
    result.history = planCockpitHistory(db, data, result, options, uploads);
    return result;
  } finally {
    db.close();
  }
}
export function cockpitSummary(plan) {
  return {
    source: plan.source,
    notes: plan.notes,
    skipped: plan.skipped,
    inactive: plan.inactive,
    counts: {
      ...Object.fromEntries(['drivers', 'cars', 'tracks'].map((g) => [g, plan[g].length])),
      technology: plan.history.cars.length,
      history: plan.history.records.length,
    },
    examples: Object.fromEntries(
      ['drivers', 'cars', 'tracks'].map((g) => [g, plan[g].slice(0, 15).map((item) => item.name)])
    ),
    history: {
      kinds: Object.fromEntries(
        [...new Set(plan.history.records.map((r) => r.kind))].map((kind) => [
          kind,
          plan.history.records.filter((r) => r.kind === kind).length,
        ])
      ),
      duplicates: plan.history.duplicates,
      empty: plan.history.empty,
      unresolved: plan.history.issues.length,
      issues: plan.history.issues.slice(0, 100),
    },
  };
}

// Stable target signature: fresh IDs for proposed additions differ on each preview.
export function cockpitSignature(plan) {
  const references = new Map(
    ['drivers', 'cars', 'tracks'].flatMap((group) => plan[group].map((row) => [row.id, `${group}:${row.sourceId}`]))
  );
  const target = (id) => references.get(id) || id;
  return {
    summary: cockpitSummary(plan),
    mappings: plan.history.mappings.map((row) => ({ ...row, id: target(row.id) })),
    cars: plan.history.cars.map((row) => ({ ...row, carId: target(row.carId) })),
    records: plan.history.records.map((row) => ({
      key: row.key,
      driverId: target(row.driverId),
      carId: target(row.carId),
      trackId: target(row.trackId),
    })),
  };
}
