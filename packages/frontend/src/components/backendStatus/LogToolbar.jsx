import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LOG_LEVELS } from './statusLog'

/** How many lines are shown, the level filter (all or one) and the button clearing the log. */
export default function LogToolbar({ count, filter, onFilterChange, onClear }) {
  const { t } = useTranslation('layout')
  return (
    <div className="flex items-center justify-between px-4 py-2 border-y border-border">
      <span className="text-xs text-muted-foreground">{t('statusPopup.logsCount', { count })}</span>
      <div className="flex items-center gap-1.5">
        {['all', ...LOG_LEVELS].map((level) => (
          <button
            key={level}
            aria-pressed={filter === level}
            onClick={() => onFilterChange(level)}
            className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${filter === level ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {level === 'all' ? t('statusPopup.filterAll') : level}
          </button>
        ))}
        <Button variant="ghost" size="icon-sm" onClick={onClear} title={t('common:clear')}>
          <Trash2 className="size-3" />
        </Button>
      </div>
    </div>
  )
}
