import { useTranslation } from 'react-i18next'
import { PanelRightClose, PanelRightOpen, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

/** The track being balanced, a new session, and the standings toggle. */
export default function BalancingToolbar({
  tracks,
  trackId,
  onTrackChange,
  onNewSession,
  newSessionDisabled,
  showStandings,
  onToggleStandings,
}) {
  const { t } = useTranslation('balancing')
  const selectedTrack = tracks.find((track) => track.id === trackId)

  return (
    <div
      data-testid="balancing-toolbar"
      className="border-b px-4 py-2.5 flex flex-wrap gap-3 items-center justify-between"
    >
      <div className="flex flex-wrap items-center gap-3 min-w-0">
        <Select value={trackId || ''} onValueChange={onTrackChange}>
          {/* A long track name ends with an ellipsis instead of being cut mid-letter */}
          <SelectTrigger className="w-48" title={selectedTrack?.name}>
            <SelectValue placeholder={t('page.trackPlaceholder')}>
              <span className="min-w-0 truncate">{selectedTrack?.name}</span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {tracks.map((track) => (
              <SelectItem key={track.id} value={track.id}>
                {track.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-sm font-medium text-muted-foreground">{t('page.title')}</span>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onNewSession} disabled={newSessionDisabled}>
          <Plus className="size-4" />
          {t('page.newSession')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleStandings}
          title={showStandings ? t('page.hideStandings') : t('page.showStandings')}
        >
          {showStandings ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
        </Button>
      </div>
    </div>
  )
}
