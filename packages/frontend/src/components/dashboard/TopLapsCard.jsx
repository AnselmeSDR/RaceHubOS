import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Timer } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import DriverAvatar from '@/components/driver/DriverAvatar'
import { formatLap, PODIUM_COLORS } from './format'

const API_URL = import.meta.env.VITE_API_URL || '/api'

/** The ten fastest laps of the championships, one per driver, with car and track. */
export default function TopLapsCard() {
  const { t } = useTranslation('dashboard')
  const [topLaps, setTopLaps] = useState([])

  useEffect(() => {
    fetch(`${API_URL}/stats/laptimes?limit=10&sortBy=lapTime&sortOrder=asc&unique=true&has_championship=true`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.success) setTopLaps(d.data || [])
      })
      .catch(() => {})
  }, [])

  if (topLaps.length === 0) return null

  return (
    <Card data-testid="dashboard-top-laps">
      <CardContent>
        <div className="flex items-center gap-2 mb-4">
          <Timer className="size-4 text-green-500" />
          <h2 className="font-semibold text-sm">{t('topLaps.title')}</h2>
        </div>
        <div className="space-y-2">
          {topLaps.map((lap, i) => (
            <div key={i} className="flex items-center gap-3 p-1.5 -mx-1.5 rounded-lg">
              <span
                className={`w-5 text-center font-bold text-xs ${i < 3 ? PODIUM_COLORS[i] : 'text-muted-foreground'}`}
              >
                {i + 1}
              </span>
              {lap.driver && <DriverAvatar driver={lap.driver} />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{lap.driver?.name || '?'}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {lap.car?.brand} {lap.car?.model} · {lap.track?.name}
                </p>
              </div>
              <span className="font-mono font-bold text-purple-500 text-xs">{formatLap(lap.lapTime)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
