import { tx, useExtensions, locale } from '../../i18n/raceScreens'
import { useState } from 'react'
import { useTrackExtras } from './useTrackExtras'
import { useDevice } from '../../context/DeviceContext'
import { pitPlan } from '../../lib/pitPlan.mjs'
import { screenTime as formatScreenTime } from '../../lib/raceScreen.mjs'
const screenTime = (value) => formatScreenTime(value, locale())
const url = `${import.meta.env.VITE_API_URL || ''}/api/preferences/trackExtras`
export function TrackExtrasSettings() {
  useExtensions()
  const stored = useTrackExtras(),
    [draft, setConfig] = useState(null),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false)
  const config = draft ?? stored
  async function save() {
    setBusy(true)
    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: config }),
      })
      if (!res.ok || !(await res.json()).success) throw new Error(tx('Speichern fehlgeschlagen.'))
      window.dispatchEvent(new CustomEvent('race:extras-saved', { detail: config }))
      setMessage(tx('Zwischenzeiten und Boxenplan gespeichert.'))
    } catch (e) {
      setMessage(e.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="rounded-xl border bg-card p-5 space-y-3" aria-label={tx('Zwischenzeiten und Boxenplan')}>
      <h2 className="text-xl font-semibold">{tx('Zwischenzeiten und Boxenplan')}</h2>
      <label className="block">
        <input
          type="checkbox"
          checked={config.sectors}
          onChange={(e) => setConfig({ ...config, sectors: e.target.checked })}
        />{' '}
        {tx('Abschnittszeiten in der Rennübersicht anzeigen')}
      </label>
      <p className="text-sm text-muted-foreground">
        {tx(
          'Eine Zwischenzeitschiene ergibt zwei Abschnitte: Start/Ziel → Zwischenzeit und Zwischenzeit → Start/Ziel. Die erste vollständige Messung benötigt zwei Start/Ziel-Durchfahrten. Fehlende oder doppelte Messungen bleiben leer. Zwei korrekt programmierte Messstellen ergeben drei Abschnitte. Im Rennbildschirm sind „Abschnittszeiten“ und „Boxenplan“ einzeln in Lage, Größe, Farben und Sichtbarkeit einstellbar.'
        )}
      </p>
      <label className="block">
        <input
          type="checkbox"
          checked={config.pitPlan}
          onChange={(e) => setConfig({ ...config, pitPlan: e.target.checked })}
        />{' '}
        {tx('Tankreihenfolge empfehlen (ab 5/15, niedrigster Tank zuerst)')}
      </label>
      <label className="block">
        {tx('Parallele Tankplätze')}{' '}
        <select
          aria-label={tx('Parallele Tankplätze')}
          className="border rounded bg-background p-1"
          value={config.pitPlaces}
          onChange={(e) => setConfig({ ...config, pitPlaces: Number(e.target.value) })}
        >
          <option value="1">1</option>
          <option value="2">2</option>
        </select>
      </label>
      <div className="flex gap-4 flex-wrap">
        {[
          ['leftRoute', tx('Anfahrt links')],
          ['rightRoute', tx('Anfahrt rechts')],
        ].map(([key, label]) => (
          <label key={key}>
            {tx(label)}{' '}
            <input
              aria-label={label}
              className="border rounded bg-background p-1"
              maxLength={80}
              value={tx(config[key])}
              onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        {tx(
          'Bei einer gemeinsamen Einfahrt mit zusätzlicher Weiche können zwei parallele Tankplätze verwendet werden. Die CU meldet Autos in der Boxengasse, keine eindeutige Links-/Rechts-Belegung. Die Reihenfolge ist eine Empfehlung ohne automatische Weichensteuerung oder Wartezwang. Beide Plätze müssen tatsächlich tanken können; das bitte mit je einem Auto an jedem Platz testen. Bei leerem Tank sofort tanken.'
        )}
      </p>
      <button className="rounded border px-4 py-2" disabled={busy} onClick={save}>
        {tx('Zwischenzeiten und Boxenplan speichern')}
      </button>
      {message && <p role="status">{tx(message)}</p>}
    </section>
  )
}
export function TrackExtrasPanel({ entries, planning = true }) {
  useExtensions()
  const config = useTrackExtras(),
    device = useDevice()
  return (
    <div className="space-y-2 p-3 text-sm" aria-label={tx('Zwischenzeitmessung und Tankplanung')}>
      {config.sectors &&
        entries.map((e) => (
          <div key={e.id || e.controller}>
            {e.driver?.name || tx('Regler {{v0}}', { v0: e.controller + 1 })} ·{' '}
            {e.stats?.sectors?.completed ? tx('Letzte Runde') : tx('Laufende Runde')}: A1{' '}
            {screenTime(e.stats?.sectors?.sector1)} · A2 {screenTime(e.stats?.sectors?.sector2)}
            {e.stats?.sectors?.sector3 != null && <> · A3 {screenTime(e.stats.sectors.sector3)}</>}
          </div>
        ))}
      {config.pitPlan && planning && <p>{tx(pitPlan(entries, device, { ...config, translate: tx }))}</p>}
    </div>
  )
}
