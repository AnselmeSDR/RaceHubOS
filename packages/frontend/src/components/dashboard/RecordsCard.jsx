import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Medal, Timer, Trophy, Zap } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatLap } from './format'

const API_URL = import.meta.env.VITE_API_URL || '/api'

/** One record: what it is, who holds it, its value. */
function RecordTile({ Icon, color, label, holder, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
      <div className="flex items-center gap-2 min-w-0">
        <Icon className={`size-4 ${color} shrink-0`} />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm font-medium truncate">{holder?.name || '?'}</p>
        </div>
      </div>
      <span className={`font-mono font-bold ${color} shrink-0`}>{value}</span>
    </div>
  )
}

/** The all-time records of championship sessions: fastest lap, most wins, most podiums. */
export default function RecordsCard() {
  const { t } = useTranslation('dashboard')
  const [records, setRecords] = useState(null)

  useEffect(() => {
    fetch(`${API_URL}/stats/records?has_championship=true`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.success) setRecords(d.data)
      })
      .catch(() => {})
  }, [])

  if (!records) return null

  return (
    <Card data-testid="dashboard-records">
      <CardContent>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="size-4 text-yellow-500" />
          <h2 className="font-semibold text-sm">{t('records.title')}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {records.fastestLap && (
            <RecordTile
              Icon={Timer}
              color="text-green-500"
              label={t('records.fastestLap')}
              holder={records.fastestLap.driver}
              value={formatLap(records.fastestLap.time)}
            />
          )}
          {records.mostWins && (
            <RecordTile
              Icon={Trophy}
              color="text-yellow-500"
              label={t('records.mostWins')}
              holder={records.mostWins.driver}
              value={records.mostWins.count}
            />
          )}
          {records.mostPodiums && (
            <RecordTile
              Icon={Medal}
              color="text-orange-500"
              label={t('records.mostPodiums')}
              holder={records.mostPodiums.driver}
              value={records.mostPodiums.count}
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}
