import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Flag, Timer, Trophy } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

/** Shortcuts to start a race, the championships and the statistics. */
export default function QuickActions() {
  const { t } = useTranslation('dashboard')
  const actions = [
    { to: '/race', icon: Flag, label: t('quickActions.startRace'), color: 'text-green-500' },
    {
      to: '/championships',
      icon: Trophy,
      label: t('glossary:championship', { count: 2 }),
      color: 'text-yellow-500',
    },
    { to: '/stats', icon: Timer, label: t('layout:nav.stats'), color: 'text-blue-500' },
  ]

  return (
    <Card data-testid="dashboard-quick-actions">
      <CardContent>
        <h2 className="font-semibold text-sm mb-3">{t('quickActions.title')}</h2>
        <div className="space-y-1.5">
          {actions.map((a) => (
            <Link
              key={a.to}
              to={a.to}
              className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <a.icon className={`size-4 ${a.color}`} />
                <span className="text-sm">{a.label}</span>
              </div>
              <ArrowRight className="size-3.5 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
