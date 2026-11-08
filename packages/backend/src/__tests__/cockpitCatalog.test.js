import { jest } from '@jest/globals';
import { cockpitCatalogCandidates, hasCockpitCatalog, storeCockpitCatalog } from '../lib/cockpitCatalog.js';
import { mapCar } from '../lib/cockpitMappers.js';

const row = {
  key: 'car-1',
  targetId: '',
  catalogSerial: 'OWN-1',
  data: { brand: 'Own', model: 'Car', year: 1888, tyresFront: 'F', tyresRear: 'R', weightGrams: 90 },
};
const catalog = { catalogEntry: {} };

test('catalog is optional and validates all reviewed references before writing', () => {
  expect(hasCockpitCatalog({})).toBe(false);
  expect(cockpitCatalogCandidates({ cars: [row] }, false, {}).size).toBe(0);
  expect(() => cockpitCatalogCandidates({ cars: [row] }, true, {})).toThrow('not installed');
  expect(() => cockpitCatalogCandidates({ cars: [row] }, 'true', catalog)).toThrow();
  for (const cars of [
    [{ ...row, catalogSerial: '' }],
    [row, { ...row, key: 'duplicate' }],
    [{ ...row, data: { ...row.data, brand: '' } }],
  ])
    expect(() => cockpitCatalogCandidates({ cars }, true, catalog)).toThrow();
  const candidate = cockpitCatalogCandidates({ cars: [row] }, true, catalog).get(row.key);
  expect(candidate).toMatchObject({
    serial: 'OWN-1',
    brand: 'Own',
    year: 1888,
    tyresFront: 'F',
    tyresRear: 'R',
    weightGrams: 90,
  });
  expect(candidate).not.toHaveProperty('maxSpeed');
});

test('catalog additions preserve axle details and link only newly created cars', async () => {
  const tx = {
    catalogEntry: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
    car: { update: jest.fn() },
  };
  const candidate = cockpitCatalogCandidates({ cars: [row] }, true, catalog).get(row.key);
  const image = jest.fn().mockResolvedValue('/api/img/cars/copy.png');
  expect(await storeCockpitCatalog(tx, candidate, row, '/api/img/cars/source.png', 'new', image)).toBe(
    'catalogImported'
  );
  expect(tx.catalogEntry.create).toHaveBeenCalledWith({ data: { ...candidate, img: '/api/img/cars/source.png' } });
  expect(tx.car.update).toHaveBeenCalledWith({ where: { id: 'new' }, data: { serial: 'OWN-1' } });
  tx.car.update.mockClear();
  await storeCockpitCatalog(tx, candidate, { ...row, targetId: 'linked', image: {} }, null, 'linked', image);
  expect(image).toHaveBeenCalledTimes(1);
  expect(tx.car.update).not.toHaveBeenCalled();
  tx.catalogEntry.findUnique.mockResolvedValue({ serial: 'OWN-1', tyresRear: 'Preserve' });
  tx.catalogEntry.create.mockClear();
  image.mockClear();
  expect(
    await storeCockpitCatalog(tx, candidate, { ...row, targetId: 'linked', image: {} }, null, 'linked', image)
  ).toBe('catalogSkipped');
  expect(tx.catalogEntry.create).not.toHaveBeenCalled();
  expect(image).not.toHaveBeenCalled();
});

test('mapping uses explicit references and units without guessing from a car name', () => {
  const mapped = mapCar({ Car: 'Car 12345', Brand: 'Own', WeightGrams: 90 }, {}, [
    { CarName: 'Car 12345', Property: 'Artikelnummer', Value: 'REF-8' },
    { CarName: 'Car 12345', Property: 'Reifen vorne', Value: 'Front' },
    { CarName: 'Car 12345', Property: 'Reifen hinten', Value: 'Rear' },
    { CarName: 'Car 12345', Property: 'Länge (mm)', Value: '120' },
    { CarName: 'Car 12345', Property: 'Reifen', Value: 'Unassigned tyre reference' },
  ]);
  expect(mapped.data.notes).toBe('Reifen: Unassigned tyre reference');
  expect(mapped.catalogSerial).toBe('REF-8');
  expect(mapped.data).toMatchObject({ tyresFront: 'Front', tyresRear: 'Rear', lengthMm: 120, weightGrams: 90 });
  expect(mapCar({ Car: 'Car 12345' }, {}, []).catalogSerial).toBe('');
});
