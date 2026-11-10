import { useTranslation } from 'react-i18next'
import { AlertTriangle, Copy } from 'lucide-react'
import { SessionType } from '@racehubos/shared'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CONTROLLER_COLORS } from '@/lib/colors'
import { CONTROLLERS, availableFor } from './controllerConfigs'

const NONE = '_none'
const CELL = 'w-full h-8 text-xs border-none shadow-none bg-transparent hover:bg-muted/50 transition-colors'

function Picker({ value, items, label, onChange }) {
  return (
    <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? '' : v)}>
      <SelectTrigger className={CELL}>
        <SelectValue placeholder="---" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>---</SelectItem>
        {items.map((item) => (
          <SelectItem key={item.id} value={item.id}>
            {label(item)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * The six controllers of a draft: driver, car and grid place of each (cars only in balancing),
 * what is half set, and a copy of the free practice's when there is one.
 */
export default function ControllersTable({ session, configs, drivers, cars, incomplete, onChange, onCopyPractice }) {
  const { t } = useTranslation('championships')
  const withDrivers = session.type !== SessionType.BALANCING

  return (
    <>
      {onCopyPractice && (
        <div className="flex justify-end">
          <button
            onClick={onCopyPractice}
            className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600"
          >
            <Copy className="size-3" /> {t('sessionSection.copyFromPractice')}
          </button>
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted-foreground text-xs uppercase">
            <th className="px-2 pb-2 font-medium w-12">{t('sessionSection.table.ctrl')}</th>
            {withDrivers && <th className="px-2 pb-2 font-medium">{t('sessionSection.table.driver')}</th>}
            <th className="px-2 pb-2 font-medium">{t('sessionSection.table.car')}</th>
            {withDrivers && <th className="px-2 pb-2 font-medium w-16">{t('sessionSection.table.grid')}</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {CONTROLLERS.map((ctrl) => (
            <tr key={ctrl} className="text-foreground">
              <td className="px-2 py-2">
                <span
                  className={`inline-flex items-center justify-center size-6 rounded-full text-white text-xs font-bold ${CONTROLLER_COLORS[ctrl]}`}
                >
                  {ctrl + 1}
                </span>
              </td>
              {withDrivers && (
                <td className="px-2 py-2">
                  <Picker
                    value={configs[ctrl].driverId}
                    items={availableFor(drivers, configs, ctrl, 'driverId')}
                    label={(d) => d.name}
                    onChange={(v) => onChange(ctrl, 'driverId', v)}
                  />
                </td>
              )}
              <td className="px-2 py-2">
                <Picker
                  value={configs[ctrl].carId}
                  items={availableFor(cars, configs, ctrl, 'carId')}
                  label={(c) => `${c.brand} ${c.model}`}
                  onChange={(v) => onChange(ctrl, 'carId', v)}
                />
              </td>
              {withDrivers && (
                <td className="px-2 py-2">
                  <Input
                    key={`grid-${ctrl}-${configs[ctrl].gridPos}`}
                    type="number"
                    min="1"
                    max="6"
                    defaultValue={configs[ctrl].gridPos || ''}
                    onBlur={(e) => onChange(ctrl, 'gridPos', e.target.value ? Number(e.target.value) : null)}
                    placeholder="-"
                    className="text-center h-8 w-16 border-none shadow-none bg-transparent hover:bg-muted/50 transition-colors"
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {incomplete.length > 0 && (
        <div className="p-2 bg-orange-500/10 border border-orange-500/30 rounded-lg flex items-start gap-2">
          <AlertTriangle className="size-4 text-orange-500 shrink-0 mt-0.5" />
          <p className="text-xs text-orange-600">
            {incomplete
              .map(({ controller, hasDriver }) =>
                t(hasDriver ? 'sessionSection.incompleteDriverNoCar' : 'sessionSection.incompleteCarNoDriver', {
                  n: controller + 1,
                })
              )
              .join(' · ')}
          </p>
        </div>
      )}
    </>
  )
}
