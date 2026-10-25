import { tx, useExtensions } from '../../i18n/raceScreens'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  defaultScreen,
  normalizeScreen,
  normalizeScreens,
  editScreen,
  screenFields,
  globalFields,
} from '../../lib/raceScreen.mjs'
import { RaceCanvas } from './RaceScreen'
import { loadScreens, saveScreens } from '../../lib/raceScreenStorage.mjs'

export default function RaceScreenSettings() {
  useExtensions()
  const [config, setConfig] = useState(() => normalizeScreen(defaultScreen))
  const [selected, setSelected] = useState('name')
  const [count, setCount] = useState(6)
  const [message, setMessage] = useState(tx('Layout wird geladen …'))
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [collection, setCollection] = useState(() => normalizeScreens(null))
  const [profileId, setProfileId] = useState('bisheriger-rennbildschirm')
  const [profileName, setProfileName] = useState(tx('Mein Rennbildschirm'))
  const [dirty, setDirty] = useState(false)
  useEffect(() => {
    let active = true
    loadScreens()
      .then((value) => {
        if (active) {
          const profile = value.profiles.find((p) => p.id === value.activeProfile)
          setCollection(value)
          setProfileId(profile.id)
          setProfileName(profile.name)
          setConfig(profile.layout)
          setMessage('')
          setReady(true)
        }
      })
      .catch((error) => {
        if (active) setMessage(error.message + tx(' Standardlayout wird angezeigt.'))
      })
    return () => {
      active = false
    }
  }, [])
  function edit(id, patch) {
    setSelected(id)
    if (patch) {
      setDirty(true)
      setConfig((previous) => editScreen(previous, id, patch))
      setMessage(tx('Ungespeicherte Änderungen'))
    }
  }
  async function save(mode = 'save') {
    setSaving(true)
    try {
      if (!profileName.trim()) throw new Error(tx('Bitte einen Namen für den Rennbildschirm eingeben.'))
      if (mode === 'copy' && collection.profiles.length >= 50)
        throw new Error(tx('Bis zu 50 Rennbildschirme sind möglich.'))
      const id = mode === 'copy' ? crypto.randomUUID() : profileId
      const name =
        mode === 'copy' && collection.profiles.some((p) => p.name === profileName.trim())
          ? profileName.trim() + tx(' (Kopie)')
          : profileName.trim()
      const profile = { id, name, layout: normalizeScreen(config) }
      const profiles =
        mode === 'copy'
          ? [...collection.profiles, profile]
          : collection.profiles.map((p) => (p.id === id ? profile : p))
      const next = { profiles, activeProfile: mode === 'activate' ? id : collection.activeProfile }
      await saveScreens(next)
      setCollection(next)
      setProfileId(id)
      setProfileName(name)
      setDirty(false)
      setMessage(
        mode === 'activate'
          ? tx('Rennbildschirm gespeichert und für Rennen ausgewählt.')
          : tx('Rennbildschirm gespeichert.')
      )
    } catch (error) {
      setMessage(error.message)
    } finally {
      setSaving(false)
    }
  }
  const box = config.widgets[selected]
  return (
    <section className="m-4 rounded-xl border bg-card p-5 space-y-4" aria-label={tx('Rennbildschirm anpassen')}>
      <Link to="/settings" className="text-primary underline">
        {tx('← Zurück zu den Einstellungen')}
      </Link>
      <h2 className="text-xl font-semibold">{tx('Rennbildschirm anpassen')}</h2>
      <div className="rounded-lg border p-4 space-y-3" aria-label={tx('Gespeicherte Rennbildschirme')}>
        <p className="text-sm">
          {tx('Für Rennen ausgewählt:')}{' '}
          <strong>
            {collection.profiles.find((p) => p.id === collection.activeProfile)?.name
              ? tx(collection.profiles.find((p) => p.id === collection.activeProfile).name)
              : ''}
          </strong>
        </p>
        <div className="flex flex-wrap gap-3 items-end">
          <label>
            {tx('Gespeicherter Rennbildschirm')}
            <select
              aria-label={tx('Gespeicherter Rennbildschirm')}
              className="block border rounded p-2 bg-background"
              value={profileId}
              disabled={!ready || saving}
              onChange={(e) => {
                if (dirty && !window.confirm(tx('Ungespeicherte Änderungen verwerfen?'))) return
                const profile = collection.profiles.find((p) => p.id === e.target.value)
                setProfileId(profile.id)
                setProfileName(profile.name)
                setConfig(profile.layout)
                setDirty(false)
                setMessage('')
              }}
            >
              {collection.profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {tx(p.name)}
                  {p.id === collection.activeProfile ? tx(' · Aktiv') : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            {tx('Name des Rennbildschirms')}
            <input
              aria-label={tx('Name des Rennbildschirms')}
              className="block border rounded p-2 bg-background"
              maxLength={80}
              value={profileName}
              disabled={!ready || saving}
              onChange={(e) => {
                setProfileName(e.target.value)
                setDirty(true)
                setMessage(tx('Ungespeicherte Änderungen'))
              }}
            />
          </label>
          <button className="rounded border px-4 py-2" disabled={!ready || saving} onClick={() => save('copy')}>
            {tx('Als weitere Vorlage speichern')}
          </button>
          <button
            className="rounded bg-primary text-primary-foreground px-4 py-2"
            disabled={!ready || saving}
            onClick={() => save('activate')}
          >
            {tx('Speichern und für Rennen verwenden')}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          {tx(
            'Vorschau und Bearbeitung ändern die aktive Auswahl erst beim Speichern. Alle Vorlagen sind in der normalen Datensicherung enthalten.'
          )}
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        {tx(
          'Die erste Fahrerzeile ist die Vorlage für alle 1 bis 6 Fahrer. Bearbeite die Anzeigen in dieser Zeile; alle weiteren Zeilen übernehmen Position, Größe, Farben und Sichtbarkeit sofort. Der Fahrerbereich wird gleichmäßig ausgefüllt. Ziehen verschiebt eine Anzeige, die gelbe Ecke ändert ihre Größe.'
        )}
      </p>
      <div className="flex flex-wrap gap-5">
        {[
          ['background', tx('Bildschirm-Hintergrund')],
          ['textColor', tx('Textfarbe')],
          ['rowBackground', tx('Fahrerzeilen-Hintergrund')],
        ].map(([id, label]) => (
          <label key={id} className="flex gap-2 items-center">
            {tx(label)}
            <input
              aria-label={label}
              type="color"
              value={config[id]}
              disabled={!ready}
              onInput={(e) => {
                setDirty(true)
                setConfig({ ...config, [id]: e.target.value })
                setMessage(tx('Ungespeicherte Änderungen'))
              }}
            />
          </label>
        ))}
        <label className="flex gap-2 items-center">
          <input
            type="checkbox"
            checked={config.autoOpen}
            disabled={!ready}
            onChange={(e) => {
              setDirty(true)
              setConfig({ ...config, autoOpen: e.target.checked })
              setMessage(tx('Ungespeicherte Änderungen'))
            }}
          />
          {tx('Beim Aktivieren einer Sitzung automatisch öffnen')}
        </label>
        <label className="flex gap-2 items-center">
          <input
            type="checkbox"
            checked={config.fullscreen}
            disabled={!ready}
            onChange={(e) => {
              setDirty(true)
              setConfig({ ...config, fullscreen: e.target.checked })
              setMessage(tx('Ungespeicherte Änderungen'))
            }}
          />
          {tx('Im Vollbild öffnen')}
        </label>
        <label>
          {tx('Fahrer in der Vorschau')}{' '}
          <select
            aria-label={tx('Fahrer in der Vorschau')}
            className="border rounded p-1 bg-background"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex gap-2 items-center">
          <input
            type="checkbox"
            checked={config.autoHeight}
            disabled={!ready}
            onChange={(e) => {
              setDirty(true)
              setConfig({ ...config, autoHeight: e.target.checked })
              setMessage(tx('Ungespeicherte Änderungen'))
            }}
          />
          {tx('Höhen automatisch aufteilen')}
        </label>
      </div>
      <div className="grid xl:grid-cols-[minmax(0,1fr)_280px] gap-4">
        <div className="min-w-0">
          <RaceCanvas config={config} selected={selected} edit={ready ? edit : undefined} demoCount={count} />
        </div>
        <div className="space-y-3">
          <label className="block">
            {tx('Anzeige')}
            <select
              aria-label={tx('Anzeige')}
              className="block w-full border rounded p-2 bg-background"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <optgroup label={tx('Gesamter Bildschirm')}>
                {globalFields.map((id) => (
                  <option key={id} value={id}>
                    {tx(screenFields[id])}
                  </option>
                ))}
              </optgroup>
              <optgroup label={tx('Angaben pro Fahrer')}>
                {Object.keys(screenFields)
                  .filter((id) => !globalFields.includes(id))
                  .map((id) => (
                    <option key={id} value={id}>
                      {tx(screenFields[id])}
                    </option>
                  ))}
              </optgroup>
            </select>
          </label>
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={box.visible}
              disabled={!ready}
              onChange={(e) => edit(selected, { visible: e.target.checked })}
            />
            {tx('Anzeigen:')} {tx(screenFields[selected])}
          </label>
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={box.customColors}
              disabled={!ready}
              onChange={(e) => edit(selected, { customColors: e.target.checked })}
            />
            {tx('Eigene Farben für diese Anzeige')}
          </label>
          {box.customColors && (
            <div className="flex flex-wrap gap-3">
              {[
                ['color', tx('Textfarbe der Anzeige')],
                ['background', tx('Hintergrund der Anzeige')],
              ].map(([key, label]) => (
                <label key={key} className="flex gap-2 items-center text-sm">
                  {tx(label)}
                  <input
                    type="color"
                    aria-label={label}
                    value={box[key]}
                    onInput={(e) => edit(selected, { [key]: e.target.value })}
                  />
                </label>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {[
              ['x', tx('Links (%)')],
              ['y', tx('Oben (%)')],
              ['w', tx('Breite (%)')],
              ['h', tx('Höhe (%)')],
              ['font', tx('Schriftgröße')],
            ].map(([key, text]) => (
              <label key={key} className="text-sm">
                {tx(text)}
                <input
                  aria-label={`${tx(screenFields[selected])}: ${text}`}
                  className="block w-full border rounded p-2 bg-background"
                  type="number"
                  step="1"
                  min={key === 'font' ? 10 : ['w', 'h'].includes(key) ? 2 : 0}
                  max={100}
                  disabled={!ready}
                  value={Math.round(box[key] * 10) / 10}
                  onChange={(e) => {
                    if (e.target.value !== '') edit(selected, { [key]: Number(e.target.value) })
                  }}
                />
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {tx(
              'Bei automatischer Aufteilung passen sich die übrigen Anzeigen derselben Spalte an eine Höhenänderung an. Die Startampel bleibt unabhängig. Bei wenigen Fahrern wachsen Zeilenhöhe und Schrift mit. Nicht verfügbare Live-Werte erscheinen als „—“.'
            )}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          className="rounded bg-primary text-primary-foreground px-4 py-2 disabled:opacity-50"
          disabled={!ready || saving}
          onClick={() => save()}
        >
          {saving ? tx('Wird gespeichert …') : tx('Rennbildschirm speichern')}
        </button>
        <button
          className="rounded border px-4 py-2"
          disabled={!ready}
          onClick={() => window.dispatchEvent(new CustomEvent('race:screen-preview', { detail: { config, count } }))}
        >
          {tx('Vollbild-Vorschau')}
        </button>
        <button
          className="rounded border px-4 py-2"
          disabled={!ready}
          onClick={() =>
            window.dispatchEvent(new CustomEvent('race:screen-preview', { detail: { config, count, lights: true } }))
          }
        >
          {tx('Startampel testen')}
        </button>
        <button
          className="rounded border px-4 py-2"
          disabled={!ready}
          onClick={() => {
            setDirty(true)
            setConfig(normalizeScreen(defaultScreen))
            setMessage(tx('Standardlayout wiederhergestellt · noch nicht gespeichert'))
          }}
        >
          {tx('Standardlayout wiederherstellen')}
        </button>
      </div>
      {message && (
        <p role="status" className="text-sm">
          {tx(message)}
        </p>
      )}
    </section>
  )
}
