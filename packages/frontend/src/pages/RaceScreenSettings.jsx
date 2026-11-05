import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RaceCanvas } from '../components/race/RaceCanvas'
import { normalizeScreen, screenFields, editScreen } from '../lib/raceScreen'
import { loadScreens, saveScreens } from '../lib/raceScreenStorage'

export default function RaceScreenSettings() {
  const { t, i18n } = useTranslation('raceScreens')
  const [settings, setSettings] = useState(null)
  const [profileId, setProfileId] = useState('default')
  const [count, setCount] = useState(6)
  const [selected, setSelected] = useState('name')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    let active = true
    loadScreens()
      .then((value) => {
        if (active) {
          setSettings(value)
          setProfileId(value.activeProfile)
        }
      })
      .catch(() => {
        if (active) setMessage(i18n.t('raceScreens:loadFailed'))
      })
    return () => {
      active = false
    }
  }, [i18n])
  const profile = settings?.profiles.find((item) => item.id === profileId)
  const config = profile?.layout
  function updateProfile(patch) {
    setSettings((previous) => ({
      ...previous,
      profiles: previous.profiles.map((item) => (item.id === profileId ? { ...item, ...patch } : item)),
    }))
    setMessage(t('unsaved'))
  }
  function edit(id, patch) {
    setSelected(id)
    if (patch) updateProfile({ layout: editScreen(config, id, patch) })
  }
  async function save() {
    setBusy(true)
    try {
      setSettings(await saveScreens(settings))
      setMessage(t('saved'))
    } catch {
      setMessage(t('saveFailed'))
    } finally {
      setBusy(false)
    }
  }
  if (!settings)
    return (
      <div className="p-6" role="status">
        {message || t('loading')}
      </div>
    )
  const box = config.widgets[selected]
  return (
    <div className="p-6 space-y-4" data-testid="race-screen-editor">
      <Button variant="outline" asChild>
        <Link to="/settings">{t('back')}</Link>
      </Button>
      <h1 className="text-2xl font-bold">{t('editor')}</h1>
      <Card>
        <CardHeader>
          <CardTitle>{t('options')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {['enabled', 'autoOpen', 'fullscreen'].map((key) => (
            <label key={key} className="flex items-center gap-2">
              <Checkbox
                data-testid={'race-screen-' + key}
                checked={settings[key]}
                onCheckedChange={(value) => setSettings((previous) => ({ ...previous, [key]: value }))}
              />
              {t(key === 'fullscreen' ? 'fullscreenOption' : key)}
            </label>
          ))}
          <p className="text-sm text-muted-foreground">{t('optionsHelp')}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('profiles')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={profileId} onValueChange={setProfileId}>
            <SelectTrigger aria-label={t('profiles')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {settings.profiles.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name || t('defaultProfile')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            aria-label={t('profileName')}
            placeholder={t('defaultProfile')}
            value={profile.name}
            onChange={(event) => updateProfile({ name: event.target.value })}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={settings.profiles.length >= 50}
              onClick={() => {
                const id = crypto.randomUUID()
                setSettings((previous) => ({
                  ...previous,
                  profiles: [...previous.profiles, { id, name: t('newProfile'), layout: normalizeScreen(config) }],
                }))
                setProfileId(id)
              }}
            >
              {t('copyProfile')}
            </Button>
            <Button
              variant="outline"
              onClick={() => setSettings((previous) => ({ ...previous, activeProfile: profileId }))}
            >
              {t('activateProfile')}
            </Button>
            <span>
              {t('activeProfile')}:{' '}
              {settings.profiles.find((item) => item.id === settings.activeProfile)?.name || t('defaultProfile')}
            </span>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('layout')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={String(count)} onValueChange={(value) => setCount(Number(value))}>
            <SelectTrigger aria-label={t('driverCount')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5, 6].map((value) => (
                <SelectItem key={value} value={String(value)}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <RaceCanvas config={config} selected={selected} edit={edit} demoCount={count} />
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger aria-label={t('widget')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(screenFields).map((id) => (
                <SelectItem key={id} value={id}>
                  {t(screenFields[id])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2">
            <Checkbox
              aria-label={t('visible')}
              checked={box.visible}
              onCheckedChange={(visible) => edit(selected, { visible })}
            />
            {t('visible')}
          </label>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {['x', 'y', 'w', 'h', 'font'].map((key) => (
              <label key={key}>
                {t(key)}
                <Input
                  aria-label={t(key)}
                  type="number"
                  step="1"
                  value={Math.round(box[key] * 10) / 10}
                  onChange={(event) => {
                    if (event.target.value !== '') edit(selected, { [key]: Number(event.target.value) })
                  }}
                />
              </label>
            ))}
          </div>
          <label className="flex items-center gap-2">
            <Checkbox checked={box.customColors} onCheckedChange={(customColors) => edit(selected, { customColors })} />
            {t('customColors')}
          </label>
          {box.customColors && (
            <div className="flex gap-3">
              {['color', 'background'].map((key) => (
                <label key={key}>
                  {t(key)}
                  <Input
                    type="color"
                    value={box[key]}
                    onChange={(event) => edit(selected, { [key]: event.target.value })}
                  />
                </label>
              ))}
            </div>
          )}
          <div className="flex gap-3">
            {['background', 'textColor', 'rowBackground'].map((key) => (
              <label key={key}>
                {t(key)}
                <Input
                  type="color"
                  value={config[key]}
                  onChange={(event) =>
                    updateProfile({ layout: normalizeScreen({ ...config, [key]: event.target.value }) })
                  }
                />
              </label>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">{t('layoutHelp')}</p>
          <div className="flex gap-2">
            <Button
              onClick={() =>
                window.dispatchEvent(new CustomEvent('race:screen-preview', { detail: { config, count } }))
              }
            >
              {t('preview')}
            </Button>
            <Button variant="outline" onClick={() => updateProfile({ layout: normalizeScreen(null) })}>
              {t('reset')}
            </Button>
          </div>
        </CardContent>
      </Card>
      <Button disabled={busy} data-testid="race-screen-save" onClick={save}>
        {t('save')}
      </Button>
      {message && <p role="status">{message}</p>}
    </div>
  )
}
