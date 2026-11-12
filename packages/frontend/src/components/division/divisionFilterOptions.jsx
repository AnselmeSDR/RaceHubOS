import { NO_DIVISION } from '@racehubos/shared'
import DivisionBadge from './DivisionBadge'

/** The options of a division column filter: each division as its badge, then the records in none. */
export function divisionFilterOptions(divisions, noneLabel) {
  return [
    ...divisions.map((division) => ({ value: division.id, label: <DivisionBadge division={division} /> })),
    { value: NO_DIVISION, label: <i className="text-muted-foreground">{noneLabel}</i> },
  ]
}
