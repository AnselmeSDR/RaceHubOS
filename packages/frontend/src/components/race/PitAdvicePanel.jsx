import { useTranslation } from 'react-i18next'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { usePitAdvice } from './usePitAdvice'
import { useLiveCuTelemetry } from './useLiveCuTelemetry'
import { planPitAdvice } from '../../lib/pitAdvice'
function LiveAdvice({ entries, config }) {
  const device = useLiveCuTelemetry()
  const { t } = useTranslation('pitAdvice')
  const plan = planPitAdvice(entries, device, config, device.now)
  return (
    <Card data-testid="pit-advice-panel">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p>{t(plan.status)}</p>
        {plan.status !== 'unavailable' && <p>{t('inside', { count: plan.inside })}</p>}
        {plan.group.map((item) => (
          <p key={item.controller}>
            {item.name || t('controller', { number: item.controller + 1 })}: {t('reading', { fuel: item.fuel })}
            {item.urgent && <strong> · {t('urgent')}</strong>}
          </p>
        ))}
        {plan.remaining > 0 && <p>{t('remaining', { count: plan.remaining })}</p>}
        <p className="text-xs text-muted-foreground">{t('limits')}</p>
      </CardContent>
    </Card>
  )
}
export default function PitAdvicePanel({ entries = [] }) {
  const { config } = usePitAdvice()
  if (!config.enabled) return null
  return <LiveAdvice entries={entries} config={config} />
}
