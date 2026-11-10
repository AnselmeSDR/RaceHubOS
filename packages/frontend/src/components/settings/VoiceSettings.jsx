import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Play, Volume2 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useVoice } from '@/context/VoiceContext'
import { voicesByLanguage } from '@/lib/speech'
import SettingSwitch from './SettingSwitch'

/** Spoken announcements: best lap (and after how many laps), podium, and the voice that speaks. */
export default function VoiceSettings() {
  const { t, i18n } = useTranslation('settings')
  const {
    bestLapEnabled,
    saveBestLapEnabled,
    podiumEnabled,
    savePodiumEnabled,
    minLaps,
    saveMinLaps,
    voiceId,
    saveVoiceId,
    speak,
  } = useVoice()
  // The browser loads its voices asynchronously: render again when they arrive
  const [, setVoicesLoaded] = useState(0)
  useEffect(() => {
    const refresh = () => setVoicesLoaded((n) => n + 1)
    speechSynthesis.addEventListener('voiceschanged', refresh)
    return () => speechSynthesis.removeEventListener('voiceschanged', refresh)
  }, [])
  const voices = voicesByLanguage(i18n.resolvedLanguage)

  return (
    <div className="space-y-4" data-testid="settings-voice">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Volume2 className={`size-4 ${bestLapEnabled ? 'text-orange-500' : 'text-muted-foreground'}`} />
          <div>
            <p className="font-medium text-sm">{t('appearance.bestLapVoice')}</p>
            <p className="text-xs text-muted-foreground">{t('appearance.bestLapVoiceDesc')}</p>
          </div>
        </div>
        <SettingSwitch
          on={bestLapEnabled}
          onToggle={() => saveBestLapEnabled(!bestLapEnabled)}
          color="bg-orange-600"
          label={t('appearance.bestLapVoice')}
        />
      </div>

      {bestLapEnabled && (
        <div className="flex items-center justify-between pl-7">
          <p className="text-sm text-muted-foreground">{t('appearance.minLapsBeforeAnnounce')}</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => saveMinLaps(minLaps - 1)}
              className="size-7 rounded border border-border flex items-center justify-center text-sm hover:bg-muted"
            >
              -
            </button>
            <span className="w-8 text-center font-mono text-sm">{minLaps}</span>
            <button
              onClick={() => saveMinLaps(minLaps + 1)}
              className="size-7 rounded border border-border flex items-center justify-center text-sm hover:bg-muted"
            >
              +
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Volume2 className={`size-4 ${podiumEnabled ? 'text-yellow-500' : 'text-muted-foreground'}`} />
          <div>
            <p className="font-medium text-sm">{t('appearance.podiumVoice')}</p>
            <p className="text-xs text-muted-foreground">{t('appearance.podiumVoiceDesc')}</p>
          </div>
        </div>
        <SettingSwitch
          on={podiumEnabled}
          onToggle={() => savePodiumEnabled(!podiumEnabled)}
          color="bg-yellow-600"
          label={t('appearance.podiumVoice')}
        />
      </div>

      {(bestLapEnabled || podiumEnabled) && (
        <div className="flex items-center gap-2 pl-7">
          {/* One voice per interface language, the language's default voice unless chosen */}
          <Select
            value={voices.some((v) => v.voiceURI === voiceId) ? voiceId : '_default'}
            onValueChange={(v) => saveVoiceId(v === '_default' ? '' : v)}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder={t('appearance.defaultVoice')} />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4} className="max-h-52 overflow-y-auto">
              <SelectItem value="_default">{t('appearance.defaultVoice')}</SelectItem>
              {voices.map((v) => (
                <SelectItem key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            onClick={() => speak(t('appearance.testVoicePhrase'))}
            className="size-8 shrink-0 rounded border border-border flex items-center justify-center hover:bg-muted"
            title={t('appearance.testVoice')}
          >
            <Play className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
