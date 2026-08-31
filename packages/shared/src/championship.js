/** Cycle de vie d'un championnat. Stocké en texte dans Championship.status. */
export const ChampionshipStatus = Object.freeze({
  PLANNED: 'planned',
  ACTIVE: 'active',
  FINISHED: 'finished',
})

export const CHAMPIONSHIP_STATUSES = Object.freeze(Object.values(ChampionshipStatus))

/** Comment les sessions sont créées : à la main, ou générées. */
export const ChampionshipMode = Object.freeze({
  MANUAL: 'manual',
  AUTO: 'auto',
})

export const CHAMPIONSHIP_MODES = Object.freeze(Object.values(ChampionshipMode))

export function isChampionshipStatus(value) {
  return CHAMPIONSHIP_STATUSES.includes(value)
}

export function isChampionshipMode(value) {
  return CHAMPIONSHIP_MODES.includes(value)
}
