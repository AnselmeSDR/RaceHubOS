import { DivisionScope } from '@racehubos/shared'
import { useDivisions } from './useDivisions'

/** Whether `record` is in one of `ids`; with none chosen, everything fits. */
export const fitsDivisions = (record, ids) =>
  ids.length === 0 || (record?.divisions ?? []).some((division) => ids.includes(division.id))

/**
 * A championship's filter, `divisionIds` mixing driver divisions and car categories: each scope's
 * divisions, the ids chosen in each, and whether a driver or a car fits them.
 */
export function useDivisionFilter(divisionIds) {
  const divisions = useDivisions(DivisionScope.DRIVER)
  const categories = useDivisions(DivisionScope.CAR)
  const driverIds = divisionIds.filter((id) => divisions.some((d) => d.id === id))
  const carIds = divisionIds.filter((id) => categories.some((c) => c.id === id))
  return {
    divisions,
    categories,
    driverIds,
    carIds,
    driverFits: (driver) => fitsDivisions(driver, driverIds),
    carFits: (car) => fitsDivisions(car, carIds),
  }
}
