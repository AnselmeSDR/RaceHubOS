import { useTranslation } from 'react-i18next'
import { Clock, Flag, FlaskConical, PanelRightClose, PanelRightOpen, Plus } from 'lucide-react'
import { STANDARD_SESSION_TYPES, SessionType, sessionTypeFullKey } from '@racehubos/shared'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

// Tailwind cannot build class names at runtime, so each type's colour is
// spelled out; the list of types themselves comes from @racehubos/shared
const TAB_STYLE = {
  [SessionType.PRACTICE]: {
    icon: FlaskConical,
    color: 'data-active:!text-session-practice hover:!text-session-practice',
  },
  [SessionType.QUALIF]: { icon: Clock, color: 'data-active:!text-session-qualif hover:!text-session-qualif' },
  [SessionType.RACE]: { icon: Flag, color: 'data-active:!text-session-race hover:!text-session-race' },
}

/** The track and session type of the free session, a new session, and the standings toggle. */
export default function FreeSessionToolbar({
  tracks,
  trackId,
  onTrackChange,
  type,
  onTypeChange,
  onNewSession,
  newSessionDisabled,
  showStandings,
  onToggleStandings,
}) {
  const { t } = useTranslation('freeSession')
  const selectedTrack = tracks.find((track) => track.id === trackId)

  return (
    <div
      data-testid="free-session-toolbar"
      className="border-b px-4 py-2.5 flex flex-wrap gap-3 items-center justify-between"
    >
      <div className="flex flex-wrap items-center gap-3 min-w-0">
        <Select value={trackId || ''} onValueChange={onTrackChange}>
          {/* A long track name ends with an ellipsis instead of being cut mid-letter */}
          <SelectTrigger className="w-48" title={selectedTrack?.name}>
            <SelectValue placeholder={t('topBar.selectTrackPlaceholder')}>
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

        <Tabs value={type} onValueChange={onTypeChange}>
          <TabsList className="h-auto flex-wrap">
            {STANDARD_SESSION_TYPES.map((sessionType) => {
              const { icon: Icon, color } = TAB_STYLE[sessionType]
              return (
                <TabsTrigger key={sessionType} value={sessionType} className={color}>
                  <Icon className="size-3.5" />
                  {t(sessionTypeFullKey(sessionType))}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </Tabs>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onNewSession} disabled={newSessionDisabled}>
          <Plus className="size-4" />
          {t('topBar.newSession')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleStandings}
          title={showStandings ? t('topBar.hideStandings') : t('topBar.showStandings')}
          className={showStandings ? 'bg-primary/10 text-primary' : ''}
        >
          {showStandings ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
        </Button>
      </div>
    </div>
  )
}
