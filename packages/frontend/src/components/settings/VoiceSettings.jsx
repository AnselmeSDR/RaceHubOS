import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Play } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useVoice } from '@/context/VoiceContext'
import { voicesByLanguage } from '@/lib/speech'
import SettingSwitch from './SettingSwitch'
import SettingsPanel, { SettingRow } from './SettingsPanel'

/**
 * Spoken announcements: the best lap, after how many laps it starts being announced (a setting of its
 * own), the podium, and the voice that speaks.
 */
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

  const STEP = 'size-7 rounded border border-border flex items-center justify-center text-sm hover:bg-muted'

  return (
    <SettingsPanel title={t('appearance.voiceTitle')} testId="settings-voice">
      <SettingRow label={t('appearance.bestLapVoice')} description={t('appearance.bestLapVoiceDesc')}>
        <SettingSwitch
          on={bestLapEnabled}
          onToggle={() => saveBestLapEnabled(!bestLapEnabled)}
          label={t('appearance.bestLapVoice')}
        />
      </SettingRow>

      {/* A setting of its own, shown while the announcement it holds back is on */}
      {bestLapEnabled && (
        <SettingRow
          sub
          testId="settings-min-laps"
          label={t('appearance.minLapsBeforeAnnounce')}
          description={t('appearance.minLapsDesc')}
        >
          <button onClick={() => saveMinLaps(minLaps - 1)} className={STEP} aria-label={t('appearance.fewerLaps')}>
            −
          </button>
          <span className="w-8 text-center font-mono text-sm">{minLaps}</span>
          <button onClick={() => saveMinLaps(minLaps + 1)} className={STEP} aria-label={t('appearance.moreLaps')}>
            +
          </button>
        </SettingRow>
      )}

      <SettingRow label={t('appearance.podiumVoice')} description={t('appearance.podiumVoiceDesc')}>
        <SettingSwitch
          on={podiumEnabled}
          onToggle={() => savePodiumEnabled(!podiumEnabled)}
          label={t('appearance.podiumVoice')}
        />
      </SettingRow>

      {(bestLapEnabled || podiumEnabled) && (
        <SettingRow label={t('appearance.voice')}>
          {/* One voice per interface language, the language's default voice unless chosen */}
          <Select
            value={voices.some((v) => v.voiceURI === voiceId) ? voiceId : '_default'}
            onValueChange={(v) => saveVoiceId(v === '_default' ? '' : v)}
          >
            <SelectTrigger className="w-56" aria-label={t('appearance.voice')}>
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
        </SettingRow>
      )}
    </SettingsPanel>
  )
}
