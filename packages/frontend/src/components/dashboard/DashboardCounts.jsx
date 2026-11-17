import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const API_URL = import.meta.env.VITE_API_URL || '/api'
const COUNTS = [
  ['/drivers', '/drivers', 'glossary:driver'],
  ['/cars', '/cars', 'glossary:car'],
  ['/tracks', '/tracks', 'glossary:track'],
  ['/history', '/sessions?has_championship=true', 'glossary:session'],
]

/** How many drivers, cars, tracks and championship sessions there are, on one line, each leading to its page. */
export default function DashboardCounts() {
  const { t } = useTranslation('dashboard')
  const [counts, setCounts] = useState(null)

  useEffect(() => {
    const count = (path) =>
      fetch(`${API_URL}${path}`)
        .then((r) => (r.ok ? r.json() : {}))
        .then((body) => body.count || body.total || 0)
        .catch(() => 0)
    Promise.all(COUNTS.map(([, path]) => count(path))).then(setCounts)
  }, [])

  return (
    <p data-testid="dashboard-counts" className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-sm text-muted-foreground">
      {COUNTS.map(([to, , label], i) => (
        <Link key={to} to={to} className="lowercase hover:text-foreground">
          <b className="font-semibold text-foreground tabular-nums">{counts ? counts[i] : '-'}</b>{' '}
          {t(label, { count: counts?.[i] ?? 2 })}
        </Link>
      ))}
    </p>
  )
}
