import { filterParams, hasColumnFilters } from './listFilters'

test('selections joined with commas, empty ones left out, yes/no options always sent', () => {
  expect(filterParams({ driverId: [], unique: true })).toEqual({ unique: 'true' })
  expect(filterParams({ driverId: ['d1', 'd2'], type: ['x'], unique: false })).toEqual({
    driverId: 'd1,d2',
    type: 'x',
    unique: 'false',
  })
})

test('only a selection counts as a filter', () => {
  expect(hasColumnFilters({ driverId: [], unique: false })).toBe(false)
  expect(hasColumnFilters({ driverId: [], championshipId: ['none'] })).toBe(true)
})
