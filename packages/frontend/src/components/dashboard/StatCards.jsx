import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Car, Flag, Map, Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const API_URL = import.meta.env.VITE_API_URL || '/api'

/** How many drivers, cars, tracks and championship sessions there are, each leading to its page. */
export default function StatCards() {
  const { t } = useTranslation('dashboard')
  const [stats, setStats] = useState({ drivers: 0, cars: 0, tracks: 0, sessions: 0, loading: true })

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/drivers`).then((r) => (r.ok ? r.json() : { count: 0 })),
      fetch(`${API_URL}/cars`).then((r) => (r.ok ? r.json() : { count: 0 })),
      fetch(`${API_URL}/tracks`).then((r) => (r.ok ? r.json() : { count: 0 })),
      fetch(`${API_URL}/sessions?has_championship=true`).then((r) => (r.ok ? r.json() : { count: 0 })),
    ])
      .then(([d, c, tr, s]) => {
        setStats({
          drivers: d.count || d.total || 0,
          cars: c.count || c.total || 0,
          tracks: tr.count || tr.total || 0,
          sessions: s.count || s.total || 0,
          loading: false,
        })
      })
      .catch(() => setStats((p) => ({ ...p, loading: false })))
  }, [])

  const statCards = [
    {
      to: '/drivers',
      icon: Users,
      label: t('glossary:driver', { count: 2 }),
      value: stats.drivers,
      color: 'text-blue-500',
    },
    { to: '/cars', icon: Car, label: t('glossary:car', { count: 2 }), value: stats.cars, color: 'text-green-500' },
    {
      to: '/tracks',
      icon: Map,
      label: t('glossary:track', { count: 2 }),
      value: stats.tracks,
      color: 'text-purple-500',
    },
    {
      to: '/history',
      icon: Flag,
      label: t('glossary:session', { count: 2 }),
      value: stats.sessions,
      color: 'text-red-500',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="dashboard-stats">
      {statCards.map((s) => (
        <Link key={s.to} to={s.to}>
          <Card className="hover:ring-2 hover:ring-primary/20 transition-all">
            <CardContent className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <s.icon className={`size-5 ${s.color}`} />
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
              <span className="text-2xl font-black tabular-nums leading-none">{stats.loading ? '-' : s.value}</span>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
