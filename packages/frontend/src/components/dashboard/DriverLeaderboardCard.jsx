import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Crown, Medal } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import DriverAvatar from './DriverAvatar'
import { formatLap, PODIUM_COLORS } from './format'

const API_URL = import.meta.env.VITE_API_URL || '/api'
const PODIUM_ICONS = [Crown, Medal, Medal]

/** The ten best drivers of the championships, with their races, wins, podiums and best lap. */
export default function DriverLeaderboardCard() {
  const { t } = useTranslation('dashboard')
  const [topDrivers, setTopDrivers] = useState([])

  useEffect(() => {
    fetch(`${API_URL}/stats/drivers?has_championship=true`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.success) setTopDrivers((d.data || []).slice(0, 10))
      })
      .catch(() => {})
  }, [])

  if (topDrivers.length === 0) return null

  return (
    <Card data-testid="dashboard-driver-leaderboard">
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Crown className="size-4 text-yellow-500" />
            <h2 className="font-semibold text-sm">{t('driverLeaderboard.title')}</h2>
          </div>
          <Link to="/stats" className="text-xs text-muted-foreground hover:text-foreground">
            {t('driverLeaderboard.seeAll')}
          </Link>
        </div>
        <div className="space-y-2">
          {topDrivers.map((d, i) => {
            const PodiumIcon = PODIUM_ICONS[i] || null
            return (
              <Link
                key={d.id}
                to={`/drivers/${d.id}`}
                className="flex items-center gap-3 p-1.5 -mx-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                <span
                  className={`w-5 text-center font-bold text-xs ${i < 3 ? PODIUM_COLORS[i] : 'text-muted-foreground'}`}
                >
                  {PodiumIcon ? <PodiumIcon className="size-4 mx-auto" /> : i + 1}
                </span>
                <DriverAvatar driver={d} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{d.name}</p>
                  <p className="text-xs">
                    <span className="text-blue-500 font-medium">
                      {d.statistics?.totalRaces || 0}
                      {t('driverLeaderboard.racesShort')}
                    </span>{' '}
                    ·{' '}
                    <span className="text-yellow-500 font-medium">
                      {d.statistics?.wins || 0}
                      {t('driverLeaderboard.winsShort')}
                    </span>{' '}
                    ·{' '}
                    <span className="text-orange-400 font-medium">
                      {d.statistics?.podiums || 0}
                      {t('driverLeaderboard.podiumsShort')}
                    </span>
                  </p>
                </div>
                {d.statistics?.bestLap && (
                  <span className="text-xs font-mono text-purple-500 font-bold">{formatLap(d.statistics.bestLap)}</span>
                )}
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
