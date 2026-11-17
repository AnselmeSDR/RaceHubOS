import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useApp } from '@/context/AppContext'
import { LANGUAGES } from '@/i18n'
import Segmented from './Segmented'
import SettingsPanel, { SettingRow } from './SettingsPanel'

const API_URL = import.meta.env.VITE_API_URL || ''

/** How the app looks: theme, default list view and language. */
export default function AppearanceSettings() {
  const { t, i18n } = useTranslation('settings')
  const { isDark, toggleTheme } = useApp()
  const [defaultViewMode, setDefaultViewMode] = useState('grid')

  useEffect(() => {
    fetch(`${API_URL}/api/preferences/viewMode:default`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) setDefaultViewMode(d.data)
      })
      .catch(() => {})
  }, [])

  function handleDefaultViewChange(mode) {
    setDefaultViewMode(mode)
    fetch(`${API_URL}/api/preferences/viewMode:default`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: mode }),
    }).catch(() => {})
  }

  return (
    <SettingsPanel title={t('appearance.title')} testId="settings-appearance">
      <SettingRow label={t('appearance.theme')}>
        <Segmented
          label={t('appearance.theme')}
          value={isDark ? 'dark' : 'light'}
          onChange={toggleTheme}
          options={[
            { value: 'light', label: t('appearance.light') },
            { value: 'dark', label: t('appearance.dark') },
          ]}
        />
      </SettingRow>
      <SettingRow label={t('appearance.defaultView')}>
        <Segmented
          label={t('appearance.defaultView')}
          value={defaultViewMode}
          onChange={handleDefaultViewChange}
          options={[
            { value: 'grid', label: t('common:grid') },
            { value: 'list', label: t('common:list') },
          ]}
        />
      </SettingRow>
      <SettingRow label={t('appearance.language')}>
        <Select value={i18n.language} onValueChange={(lng) => i18n.changeLanguage(lng)}>
          <SelectTrigger className="w-36" aria-label={t('appearance.language')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            {LANGUAGES.map((l) => (
              <SelectItem key={l.code} value={l.code}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>
    </SettingsPanel>
  )
}
