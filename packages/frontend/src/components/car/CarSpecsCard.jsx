import { useTranslation } from 'react-i18next'
import { CAR_NUMBER_SPECS, CAR_TEXT_SPECS } from '@racehubos/shared'
import { Card, CardContent } from '@/components/ui/card'

/**
 * Equipment and measurements of a car.
 *
 * Only what has been filled in is shown: an empty card is not displayed at all,
 * rather than a grid of blank lines on a car nobody has documented yet.
 */
export default function CarSpecsCard({ car }) {
  const { t } = useTranslation('cars')

  const equipment = CAR_TEXT_SPECS.filter((field) => field !== 'notes' && car?.[field])
  const measurements = CAR_NUMBER_SPECS.filter((field) => car?.[field] != null)


  const section = (title, fields, suffix) => fields.length > 0 && (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{title}</h3>
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
        {fields.map((field) => (
          <div key={field}>
            <dt className="text-xs text-muted-foreground">{t(`fields.${field}`)}</dt>
            <dd className="text-sm text-foreground" data-testid={`car-spec-${field}`}>
              {car[field]}{suffix?.(field) ?? ''}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )

  const empty = equipment.length === 0 && measurements.length === 0 && !car?.notes

  return (
    <Card data-testid="car-specs">
      <CardContent className="p-4 space-y-4">
        {empty && (
          <p className="text-sm text-muted-foreground">{t('specs.empty')}</p>
        )}
        {section(t('fields.equipment'), equipment)}
        {section(t('fields.measurements'), measurements)}
        {car.notes && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              {t('fields.notes')}
            </h3>
            <p className="text-sm text-foreground whitespace-pre-line">{car.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
