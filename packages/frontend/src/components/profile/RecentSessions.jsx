import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import LapTime from '@/components/race/LapTime'
import { GRID_HEAD, GRID_LIST, GRID_ROW } from '@/lib/gridList'
import { rankClass } from './podium'
import SessionTypeBadge from './SessionTypeBadge'

const SHOWN = 8
const CUT = 'truncate'
const COLUMNS = {
  date: { width: 'max-content', label: 'common:date' },
  type: { width: 'max-content', label: 'common:type' },
  session: { width: 'minmax(0,auto)', label: 'glossary:session' },
  track: { width: 'minmax(0,auto)', label: 'glossary:track' },
  drivers: { width: 'max-content', label: 'glossary:driver', count: 2, right: true },
  place: { width: 'max-content', label: 'common:placeShort', right: true },
  best: { width: 'max-content', label: 'common:bestShort', right: true },
}

/**
 * The last sessions of a profile, one line each, a column per `columns` key. A row is
 * `{ id, to, date, type, name, track, drivers, place, best }`; what a session does not have yet stays empty.
 */
export default function RecentSessions({ rows = [], columns, testId }) {
  const { t, i18n } = useTranslation('common')
  const day = (date) =>
    date ? new Date(date).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: '2-digit' }) : ''
  const cells = {
    date: (row) => <span className="text-muted-foreground tabular-nums">{day(row.date)}</span>,
    type: (row) => <SessionTypeBadge type={row.type} />,
    session: (row) => <span className={CUT}>{row.name}</span>,
    track: (row) => <span className={`${CUT} text-muted-foreground`}>{row.track ?? t('unknownTrack')}</span>,
    drivers: (row) => <span className="text-muted-foreground tabular-nums">{row.drivers ?? 0}</span>,
    place: (row) =>
      row.place && <span className={`font-semibold tabular-nums ${rankClass(row.place)}`}>P{row.place}</span>,
    best: (row) => row.best > 0 && <LapTime time={row.best} size="sm" className="text-muted-foreground" />,
  }

  return (
    <Card data-testid={testId}>
      <CardContent className="p-0">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">{t('recentSessions')}</h3>
        </div>
        {rows.length > 0 ? (
          <div
            className={GRID_LIST}
            style={{ gridTemplateColumns: columns.map((key) => COLUMNS[key].width).join(' ') }}
          >
            <div data-testid="columns" className={GRID_HEAD}>
              {columns.map((key) => (
                <span key={key} className={COLUMNS[key].right ? 'text-right' : ''}>
                  {t(COLUMNS[key].label, { count: COLUMNS[key].count ?? 1 })}
                </span>
              ))}
            </div>
            {rows.slice(0, SHOWN).map((row) => (
              <Link key={row.id} to={row.to} className={`${GRID_ROW} hover:bg-muted transition-colors`}>
                {columns.map((key) => (
                  <span key={key} className={`flex min-w-0 ${COLUMNS[key].right ? 'justify-end' : ''}`}>
                    {cells[key](row)}
                  </span>
                ))}
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">{t('noSessions')}</div>
        )}
      </CardContent>
    </Card>
  )
}
