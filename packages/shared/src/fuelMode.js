/** Consommation de carburant d'une session. Stocké en texte dans Session.fuelMode. */
export const FuelMode = Object.freeze({
  OFF: 'OFF',
  ON: 'ON',
})

export const FUEL_MODES = Object.freeze(Object.values(FuelMode))

export function isFuelMode(value) {
  return FUEL_MODES.includes(value)
}
