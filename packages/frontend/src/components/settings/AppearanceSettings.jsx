import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Languages, LayoutGrid, List, Moon, Shield, Sun } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useApp } from '@/context/AppContext'
import { LANGUAGES } from '@/i18n'
import SettingSwitch from './SettingSwitch'
import VoiceSettings from './VoiceSettings'

const API_URL = import.meta.env.VITE_API_URL || ''

/** Theme, default list view, spoken announcements, language and admin mode. */
export default function AppearanceSettings() {
  const { t, i18n } = useTranslation('settings')
  const { isDark, toggleTheme, isAdmin, toggleAdmin } = useApp()
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
    <Card data-testid="settings-appearance">
      <CardContent className=" space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isDark ? <Moon className="size-4 text-blue-500" /> : <Sun className="size-4 text-yellow-500" />}
            <div>
              <p className="font-medium text-sm">{isDark ? t('appearance.themeNight') : t('appearance.themeDay')}</p>
              <p className="text-xs text-muted-foreground">
                {isDark ? t('appearance.darkInterface') : t('appearance.lightInterface')}
              </p>
            </div>
          </div>
          <SettingSwitch
            on={isDark}
            onToggle={toggleTheme}
            color="bg-blue-600"
            label={isDark ? t('appearance.themeNight') : t('appearance.themeDay')}
          />
        </div>

        <div className="border-t border-border" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {defaultViewMode === 'grid' ? (
              <LayoutGrid className="size-4 text-green-500" />
            ) : (
              <List className="size-4 text-green-500" />
            )}
            <div>
              <p className="font-medium text-sm">{t('appearance.defaultView')}</p>
              <p className="text-xs text-muted-foreground">
                {defaultViewMode === 'grid' ? t('common:grid') : t('common:list')}
              </p>
            </div>
          </div>
          <SettingSwitch
            on={defaultViewMode === 'grid'}
            onToggle={() => handleDefaultViewChange(defaultViewMode === 'grid' ? 'list' : 'grid')}
            color="bg-green-600"
            label={t('appearance.defaultView')}
          />
        </div>

        <div className="border-t border-border" />

        <VoiceSettings />

        <div className="border-t border-border" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Languages className="size-4 text-blue-500" />
            <div>
              <p className="font-medium text-sm">{t('appearance.language')}</p>
              <p className="text-xs text-muted-foreground">{t('appearance.languageDesc')}</p>
            </div>
          </div>
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
        </div>

        <div className="border-t border-border" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="size-4 text-purple-500" />
            <div>
              <p className="font-medium text-sm">{t('appearance.adminMode')}</p>
              <p className="text-xs text-muted-foreground">{t('appearance.adminModeDesc')}</p>
            </div>
          </div>
          <SettingSwitch on={isAdmin} onToggle={toggleAdmin} color="bg-purple-600" label={t('appearance.adminMode')} />
        </div>
      </CardContent>
    </Card>
  )
}
