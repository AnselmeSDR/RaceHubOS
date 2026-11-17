import { useTranslation } from 'react-i18next'
import { Clock } from 'lucide-react'
import { SessionType } from '@racehubos/shared'
import { Card, CardContent } from '@/components/ui/card'
import CarPicture from '@/components/car/CarPicture'
import DriverAvatar from '@/components/driver/DriverAvatar'
import { rankClass } from '@/components/profile/podium'
import SessionTypeBadge from '@/components/profile/SessionTypeBadge'
import { GOLD, GRID_HEAD, GRID_LIST, GRID_ROW } from '@/lib/gridList'
import LapTime from './race/LapTime'

const CUT = 'truncate'
const COLUMNS = {
  driver: { width: 'minmax(0,auto)', label: 'glossary:driver' },
  car: { width: 'minmax(0,auto)', label: 'glossary:car' },
  track: { width: 'minmax(0,auto)', label: 'glossary:track' },
}
const CELLS = {
  driver: ({ driver }, t) => (
    <>
      {driver && <DriverAvatar driver={{ name: '?', ...driver }} className="size-6" />}
      <span className={`${CUT} font-medium`}>{driver?.name || t('unknown')}</span>
    </>
  ),
  car: ({ car }) =>
    car && (
      <>
        <CarPicture car={car} alt="" className="size-6" />
        <span className={CUT}>
          {car.brand} {car.model}
        </span>
      </>
    ),
  track: ({ track }) => <span className={`${CUT} text-muted-foreground`}>{track?.name}</span>,
}

/**
 * The best laps, one line each: rank, driver, car, track, kind of session and time. A profile leaves out
 * its own column with `hide` (`driver`, `car` or `track`): it would repeat itself on every line.
 */
export function RecordsList({ title, records, emptyMessage, hide }) {
  const { t } = useTranslation('common')
  const columns = Object.keys(COLUMNS).filter((key) => key !== hide)
  return (
    <Card>
      <CardContent className="p-0">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">{title || t('topRecords')}</h3>
        </div>
        {records?.length > 0 ? (
          <div
            role="table"
            className={GRID_LIST}
            style={{
              gridTemplateColumns: `max-content ${columns.map((key) => COLUMNS[key].width).join(' ')} max-content max-content`,
            }}
          >
            <div role="row" className={GRID_HEAD}>
              <span role="columnheader">#</span>
              {columns.map((key) => (
                <span key={key} role="columnheader">
                  {t(COLUMNS[key].label, { count: 1 })}
                </span>
              ))}
              <span role="columnheader">{t('type')}</span>
              <span role="columnheader" className="text-right">
                {t('time')}
              </span>
            </div>
            {records.map((record, index) => (
              <div key={record.id} role="row" data-testid="record" className={GRID_ROW}>
                <span role="cell" className={`font-bold tabular-nums ${rankClass(index + 1)}`}>
                  {index + 1}
                </span>
                {columns.map((key) => (
                  <span key={key} role="cell" className="flex min-w-0 items-center gap-2">
                    {CELLS[key](record, t)}
                  </span>
                ))}
                <span role="cell">
                  <SessionTypeBadge type={record.sessionType || SessionType.PRACTICE} />
                </span>
                <span role="cell" className="text-right">
                  <LapTime
                    time={record.lapTime}
                    size="sm"
                    className={`font-semibold ${index === 0 ? GOLD : 'text-foreground'}`}
                  />
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Clock className="size-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">{emptyMessage || t('noRecords')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
