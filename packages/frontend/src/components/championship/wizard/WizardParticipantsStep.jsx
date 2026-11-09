import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { withEmptyRow } from './wizardPlan'

// The line-up of the championship; each driver can be picked once
export default function WizardParticipantsStep({ participants, drivers, onChange }) {
  const { t } = useTranslation('championships')
  const complete = participants.filter((p) => p.driverId).length

  function availableDrivers(index) {
    const usedIds = new Set(participants.filter((_, i) => i !== index).map((p) => p.driverId))
    return drivers.filter((d) => !usedIds.has(d.id))
  }

  function update(index, driverId) {
    const next = [...participants]
    next[index] = { driverId: driverId || null, driver: drivers.find((d) => d.id === driverId) || null }
    onChange(next)
  }

  return (
    <div data-testid="championship-wizard-participants" className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('wizard.participantsCount', { count: complete })}</p>

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground text-xs uppercase bg-muted/50">
              <th className="px-3 py-2 font-medium w-8">#</th>
              <th className="px-3 py-2 font-medium">{t('glossary:driver_one')}</th>
              <th className="px-3 py-2 font-medium w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {withEmptyRow(participants).map((p, i) => (
              <tr key={i} className={p.driverId ? '' : 'bg-muted/20'}>
                <td className="px-3 py-1.5 text-xs text-muted-foreground">{p.driverId ? i + 1 : ''}</td>
                <td className="px-3 py-1.5">
                  <select
                    value={p.driverId || ''}
                    onChange={(e) => update(i, e.target.value)}
                    className="w-full px-2 py-1 border-none bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring rounded"
                  >
                    <option value="">{t('wizard.driverPlaceholder')}</option>
                    {availableDrivers(i).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-1.5">
                  {p.driverId && (
                    <button
                      aria-label={t('common:delete')}
                      onClick={() => onChange(participants.filter((_, j) => j !== i))}
                      className="p-0.5 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
