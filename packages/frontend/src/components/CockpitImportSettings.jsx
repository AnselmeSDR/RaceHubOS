import { tx, useExtensions } from '../i18n/cockpit'
import { useEffect, useState } from 'react'
const base = `${import.meta.env.VITE_API_URL || ''}/api/data`
async function request(route, body) {
  const response = await fetch(
    base + route,
    body instanceof FormData
      ? { method: 'POST', body }
      : body === undefined
        ? {}
        : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  )
  let data
  try {
    data = await response.json()
  } catch {
    throw new Error(tx('Keine gültige Antwort vom Datensicherungsdienst. Bitte Anwendung und Verbindung prüfen.'))
  }
  if (!response.ok || !data.success) throw new Error(tx(data.error || 'Vorgang fehlgeschlagen.'))
  return data
}
export default function CockpitImportSettings() {
  useExtensions()
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(() => {
      return sessionStorage.getItem('racehub:data-message') || ''
    })
  const [cockpit, setCockpit] = useState(null),
    [cockpitPreview, setCockpitPreview] = useState(null),
    [cockpitConfirm, setCockpitConfirm] = useState(false)
  const [options, setOptions] = useState({
    drivers: true,
    cars: true,
    tracks: true,
    technology: true,
    maintenance: true,
    history: true,
    includeInactive: false,
  })
  const [previous] = useState(() => sessionStorage.getItem('racehub:cockpit-backup') || '')
  useEffect(() => {
    sessionStorage.removeItem('racehub:data-message')
  }, [])
  async function run(action) {
    setBusy(true)
    setMessage(tx('Bitte warten …'))
    try {
      await action()
    } catch (e) {
      sessionStorage.removeItem('racehub:data-message')
      setMessage(e.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="rounded-xl border bg-card p-5 space-y-5" aria-label={tx('Cockpit-XP-Daten übernehmen')}>
      <div className="border-t pt-4 space-y-3">
        <h3 className="font-semibold">{tx('Cockpit-XP-Daten übernehmen')}</h3>
        <p className="text-sm text-muted-foreground">
          {tx(
            'Import nur lokal am Rennrechner über localhost. Python 3 muss installiert sein. Alle Sitzungen zuerst beenden; vor der Übernahme wird automatisch eine Sicherung erstellt.'
          )}
        </p>
        <p className="text-sm text-muted-foreground">
          {tx(
            'Unterstützt Cockpit-XP-ZIP-Sicherungen mit Stammdaten und optionaler Statistikdatenbank. Übernimmt Bilder, Fahrzeugtechnik, Wartungsstände und sicher zuordenbare historische Statistiken gemeinsam. Historie bleibt getrennt gekennzeichnet; aktuelle Einstellungen und Ergebnisse bleiben erhalten. Keine Add-ons, Lizenzen oder Hardwareprofile.'
          )}
        </p>
        <div className="flex flex-wrap gap-4">
          {[
            ['drivers', tx('Fahrer')],
            ['cars', tx('Autos')],
            ['tracks', tx('Strecken')],
            ['technology', tx('Fahrzeugtechnik')],
            ['maintenance', tx('Wartungsstände')],
            ['history', tx('Historische Statistiken')],
            ['includeInactive', tx('Auch deaktivierte Einträge')],
          ].map(([key, label]) => (
            <label className="flex gap-2" key={key}>
              <input
                type="checkbox"
                disabled={busy}
                checked={options[key]}
                onChange={(e) => {
                  setOptions({ ...options, [key]: e.target.checked })
                  setCockpitPreview(null)
                  setCockpitConfirm(false)
                }}
              />
              {tx(label)}
            </label>
          ))}
        </div>
        <label className="block">
          {tx('Cockpit-XP-ZIP auswählen')}{' '}
          <input
            aria-label={tx('Cockpit-XP-Sicherungsdatei')}
            type="file"
            accept=".zip"
            disabled={busy}
            onChange={(e) => {
              setCockpit(e.target.files?.[0] || null)
              setCockpitPreview(null)
              setCockpitConfirm(false)
            }}
          />
        </label>
        <div className="flex gap-3 flex-wrap">
          <button
            className="border rounded px-3 py-2"
            disabled={busy || !cockpit}
            onClick={() =>
              run(async () => {
                if (cockpit.size > 180 * 1024 * 1024) throw new Error(tx('ZIP-Datei größer als 180 MB.'))
                const form = new FormData()
                form.append('file', cockpit)
                form.append('options', JSON.stringify(options))
                setCockpitPreview(await request('/cockpit/preview', form))
                setCockpitConfirm(false)
                setMessage(tx('Cockpit-XP-Vorschau erstellt. Noch keine Daten übernommen.'))
              })
            }
          >
            {tx('ZIP-Sicherung prüfen')}
          </button>
        </div>
        {cockpitPreview && (
          <div className="border rounded p-3 space-y-3">
            <p className="font-semibold">
              {tx('Vorschau:')} {cockpitPreview.summary.source}
            </p>
            {[
              ['drivers', tx('Fahrer')],
              ['cars', tx('Autos')],
              ['tracks', tx('Strecken')],
            ].map(([key, label]) => (
              <p key={key}>
                <strong>
                  {tx(label)}: {cockpitPreview.summary.counts[key]}
                </strong>
                <span className="block text-sm">
                  {cockpitPreview.summary.examples[key].join(' · ') || tx('Keine neuen Einträge')}
                </span>
              </p>
            ))}
            <div className="text-sm space-y-1">
              <p>
                {tx('Fahrzeuge mit Technik-/Wartungsdaten')}: {cockpitPreview.summary.counts.technology}
              </p>
              <p>
                {tx('Neue historische Einträge')}: {cockpitPreview.summary.counts.history}
              </p>
              <p>
                {tx('Bereits importierte Statistik ausgelassen')}: {cockpitPreview.summary.history.duplicates}
              </p>
              <p>
                {tx('Leere Ergebniszeilen ausgelassen')}: {cockpitPreview.summary.history.empty}
              </p>
              <p>
                {tx('Nicht eindeutig zugeordnet')}: {cockpitPreview.summary.history.unresolved}
              </p>
              {cockpitPreview.summary.history.issues.length > 0 && (
                <details>
                  <summary>{tx('Zuordnungsprobleme anzeigen')}</summary>
                  <ul className="max-h-40 overflow-auto">
                    {cockpitPreview.summary.history.issues.map((row, i) => (
                      <li key={i}>
                        {row.name || row.sourceId} ·{' '}
                        {tx(
                          {
                            drivers: 'Fahrer',
                            cars: 'Autos',
                            tracks: 'Strecken',
                            StRennResults: 'Rennergebnisse',
                            StMoreRecords: 'Rekorde und Sektorwerte',
                            StRoundTime: 'Rundenzeiteinträge',
                            StRennCounter: 'Gesamtstände',
                            StWinnerItems: 'Rennen und Siege',
                          }[row.kind] || row.kind
                        )}{' '}
                        · {tx(row.reason === 'ambiguous' ? 'Mehrdeutige Zuordnung' : 'Keine sichere Zuordnung')}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
            <p className="text-sm">
              {tx('Bereits vorhanden/gleichnamig:')} {cockpitPreview.summary.skipped} {tx('· deaktiviert ausgelassen:')}{' '}
              {cockpitPreview.summary.inactive}
            </p>
            <p className="text-sm text-muted-foreground">
              {tx(
                'Bestehende Geschwindigkeit, Bremse, Tankwerte, Reifen und weitere Einstellungen bleiben erhalten. Neue Stammdaten erhalten Standardwerte. Technik wird mit Herkunft gespeichert; Motor und Übersetzung werden nur in leere Felder übernommen. Wartungsstände bleiben historische Stände. Der Import verändert keine Fahrzeuge auf der Bahn.'
              )}
            </p>
            <label className="flex gap-2">
              <input
                data-testid="cockpit-import-confirm"
                type="checkbox"
                checked={cockpitConfirm}
                onChange={(e) => setCockpitConfirm(e.target.checked)}
              />
              {tx(
                'Die aufgeführten Stammdaten und zugeordneten historischen Daten hinzufügen. Bestehende Einstellungen und Ergebnisse bleiben erhalten.'
              )}
            </label>
            <button
              className="rounded bg-primary text-primary-foreground px-4 py-2"
              disabled={busy || !cockpitConfirm || !Object.values(cockpitPreview.summary.counts).some((n) => n > 0)}
              onClick={() =>
                run(async () => {
                  sessionStorage.setItem(
                    'racehub:data-message',
                    tx(
                      'Cockpit-XP-Daten und gekennzeichnete Historie übernommen. Der vorherige RaceHubOS-Bestand ist zusätzlich gesichert.'
                    )
                  )
                  const result = await request('/cockpit/import', { id: cockpitPreview.id, confirmed: true })
                  sessionStorage.setItem('racehub:cockpit-backup', result.previous)
                  window.location.reload()
                })
              }
            >
              {tx('Bestätigte Datenübernahme ausführen')}
            </button>
          </div>
        )}
      </div>
      {previous && (
        <a className="text-primary underline" href={`${base}/download/${encodeURIComponent(previous)}`} download>
          {tx('Sicherung vor dem Import herunterladen')}
        </a>
      )}
      {message && <p role="status">{tx(message)}</p>}
    </section>
  )
}
