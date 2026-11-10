import { useTranslation } from 'react-i18next'
import { Clock, RefreshCw } from 'lucide-react'
import { Input } from '@/components/ui/input'

// A duration, a number of laps, or both: each is used only when ticked
export default function SessionLimitsFields({ form, onChange }) {
  const { t } = useTranslation('championships')
  const set = (patch) => onChange({ ...form, ...patch })
  return (
    <div className="flex items-center gap-3 text-sm">
      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          aria-label={t('configModal.fields.minUnit')}
          checked={form.useTime}
          onChange={(e) => set({ useTime: e.target.checked })}
          className="accent-blue-500"
        />
        <Clock className="size-3.5 text-muted-foreground" />
        <Input
          type="number"
          value={form.duration}
          onChange={(e) => set({ duration: parseInt(e.target.value) || 1 })}
          disabled={!form.useTime}
          className="w-14 h-7 text-center"
        />
        <span className="text-xs text-muted-foreground">{t('configModal.fields.minUnit')}</span>
      </label>
      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          aria-label={t('configModal.fields.lapsUnit')}
          checked={form.useLaps}
          onChange={(e) => set({ useLaps: e.target.checked })}
          className="accent-green-500"
        />
        <RefreshCw className="size-3.5 text-muted-foreground" />
        <Input
          type="number"
          value={form.maxLaps}
          onChange={(e) => set({ maxLaps: parseInt(e.target.value) || 1 })}
          disabled={!form.useLaps}
          className="w-14 h-7 text-center"
        />
        <span className="text-xs text-muted-foreground">{t('configModal.fields.lapsUnit')}</span>
      </label>
    </div>
  )
}
