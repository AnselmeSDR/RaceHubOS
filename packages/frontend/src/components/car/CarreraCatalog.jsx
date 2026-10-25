import { catalogReference } from '@racehubos/shared'
import { tx, useExtensions, locale } from '../../i18n/extensions'
import { useEffect, useRef, useState } from 'react'
const api = `${import.meta.env.VITE_API_URL || ''}/api/catalog`
async function request(path, options = {}) {
  const response = await fetch(api + path, { signal: AbortSignal.timeout(30000), ...options })
  const body = await response.json()
  if (!response.ok || !body.success) throw new Error(body.error || tx('Katalog nicht erreichbar.'))
  return body.data
}
export function CarreraCatalogSettings({ compact = false }) {
  useExtensions()
  const [status, setStatus] = useState(null),
    [error, setError] = useState(''),
    [starting, setStarting] = useState(false)
  useEffect(() => {
    let active = true,
      timer
    async function refresh() {
      try {
        const next = await request('/status')
        if (active) {
          setStatus(next)
          setError('')
          if (next.running) timer = setTimeout(refresh, 2000)
        }
      } catch (e) {
        if (active) setError(e.message)
      }
    }
    refresh()
    const update = () => {
      clearTimeout(timer)
      refresh()
    }
    window.addEventListener('carrera:catalog-update', update)
    return () => {
      active = false
      clearTimeout(timer)
      window.removeEventListener('carrera:catalog-update', update)
    }
  }, [])
  async function update() {
    setStarting(true)
    setError('')
    try {
      await request('/update', { method: 'POST' })
      window.dispatchEvent(new Event('carrera:catalog-update'))
    } catch (e) {
      setError(e.message)
    } finally {
      setStarting(false)
    }
  }
  return (
    <section
      aria-label={tx('Lokaler Autokatalog')}
      className={compact ? 'rounded border p-3 space-y-2' : 'rounded-xl border bg-card p-5 space-y-3'}
    >
      <h2 className="font-semibold">{tx('Autokatalog: Carrera, Scalextric und Superslot')}</h2>
      <p className="text-sm">
        {status
          ? tx('{{v0}} Modelle · {{v1}} Bilder lokal{{v2}}', {
              v0: status.count,
              v1: status.offlineImages,
              v2: status.updatedAt
                ? tx(' · Stand ') + new Date(status.updatedAt).toLocaleString(locale())
                : tx(' · Noch nicht geladen'),
            })
          : tx('Katalogstatus wird geladen …')}
      </p>
      {!compact && (
        <p className="text-sm text-muted-foreground">
          {tx(
            'DIGITAL 124, DIGITAL 132 und EVOLUTION aus den öffentlichen Carrera-Produktdaten. Gespeicherte Daten und Vorschaubilder sind offline nutzbar. Nur die manuelle Aktualisierung und Reifenabfrage benötigen Internet; ohne Konto und Abo. Ältere bereits gespeicherte Modelle bleiben erhalten. Nicht mehr im Herstellerangebot enthaltene Modelle sind möglicherweise nicht auffindbar. EVOLUTION ist analog und benötigt für den Einsatz an der digitalen CU einen geeigneten Umbau.'
          )}
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        {tx(
          '„Katalog aktualisieren“ lädt alle drei Marken: Carrera und Scalextric aus den Herstellerdaten, Superslot aus der öffentlichen Händlerliste von Hobbymodelismo. H-/C-Zuordnungen entstehen nur bei eindeutig identischer Modellbezeichnung; fehlende Zuordnungen werden nicht geraten. Die Listen decken nicht alle historischen Modelle ab.'
        )}
      </p>
      {status?.manufacturers && (
        <p className="text-sm">
          {Object.entries(status.manufacturers)
            .map(([name, count]) => `${name}: ${count}`)
            .join(' · ')}{' '}
          · {tx('{{count}} geprüfte H-/C-Zuordnungen', { count: status.verifiedMappings || 0 })}
        </p>
      )}
      <button
        type="button"
        className="rounded border px-3 py-2"
        disabled={!status || starting || status.running}
        onClick={update}
      >
        {starting || status?.running ? tx('Katalog wird aktualisiert …') : tx('Katalog aktualisieren')}
      </button>
      {status?.message && (
        <p role="status" className="text-sm">
          {tx(status.message)}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {tx(error)}
        </p>
      )}
    </section>
  )
}
export function CarreraLookup({ number, onNumber, onApply }) {
  useExtensions()
  const [entry, setEntry] = useState(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('')
  const [fields, setFields] = useState({ brand: true, model: true, scale: true, img: true }),
    controller = useRef(null)
  useEffect(() => () => controller.current?.abort(), [])
  async function lookup() {
    controller.current?.abort()
    const current = new AbortController()
    controller.current = current
    setBusy(true)
    setMessage('')
    setEntry(null)
    try {
      const value = await request(`/lookup/${encodeURIComponent(number.trim())}`, {
        signal: AbortSignal.any([current.signal, AbortSignal.timeout(10000)]),
      })
      if (!current.signal.aborted) setEntry(value)
    } catch (e) {
      if (!current.signal.aborted) setMessage(e.message)
    } finally {
      if (controller.current === current) setBusy(false)
    }
  }
  function change(value) {
    controller.current?.abort()
    setBusy(false)
    setEntry(null)
    setMessage('')
    onNumber(value)
  }
  return (
    <section className="rounded-lg border p-3 space-y-3" aria-label={tx('Auto aus lokalem Katalog übernehmen')}>
      <label className="block text-sm font-medium">
        {tx('Fahrzeug-Artikelnummer')}
        <input
          aria-label={tx('Fahrzeug-Artikelnummer')}
          inputMode="text"
          maxLength={12}
          className="block w-full rounded border bg-background p-2 mt-1"
          placeholder={tx('z. B. 31063, C4226 oder H4249')}
          value={number}
          onChange={(e) => change(e.target.value)}
        />
      </label>
      <p className="text-xs text-muted-foreground">
        {tx(
          'Die Artikelnummer wird mit dem Auto gespeichert. Für bestehende Autos kannst du nur die Nummer zuordnen oder ausgewählte Katalogdaten übernehmen. Rennergebnisse und CU-Einstellungen bleiben erhalten.'
        )}
      </p>
      <button type="button" className="rounded border px-3 py-2" disabled={busy || !number.trim()} onClick={lookup}>
        {busy ? tx('Suche …') : tx('Im lokalen Katalog suchen')}
      </button>
      {entry && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            {entry.img && (
              <img alt={entry.model} src={entry.img} className="h-24 w-32 object-contain rounded bg-white" />
            )}
            <div>
              <strong>{entry.model}</strong>
              <p className="text-sm">
                {entry.articleNumber} · {entry.series} · {entry.scale}
              </p>
              <a className="underline text-sm" href={entry.sourceUrl} target="_blank" rel="noreferrer">
                {tx('Produktquelle')}
              </a>
            </div>
          </div>
          {entry.equivalence && (
            <p className="text-sm">
              {tx('Geprüfte Entsprechung: {{number}}', { number: entry.equivalence.articleNumber })} ·{' '}
              {entry.equivalence.sources.map((url, index) => (
                <a key={url} className="underline mr-2" href={url} target="_blank" rel="noreferrer">
                  {tx('Modellquelle {{index}}', { index: index + 1 })}
                </a>
              ))}
            </p>
          )}
          {!entry.img && (
            <p className="text-sm">
              {tx('Kein lokales Bild vorhanden. Katalog erneut aktualisieren oder eigenes Bild wählen.')}
            </p>
          )}
          <div className="flex gap-3 flex-wrap">
            {[
              ['brand', tx('Marke')],
              ['model', tx('Modell')],
              ['scale', tx('Maßstab')],
              ['img', tx('Bild')],
            ].map(([key, label]) => (
              <label key={key} className="text-sm">
                <input
                  type="checkbox"
                  checked={fields[key]}
                  disabled={key === 'img' && !entry.img}
                  onChange={(e) => setFields({ ...fields, [key]: e.target.checked })}
                />{' '}
                {tx(label)}
              </label>
            ))}
          </div>
          <button
            type="button"
            className="rounded bg-primary text-primary-foreground px-3 py-2"
            onClick={() => {
              onApply(entry, fields)
              setMessage(tx('Ausgewählte Katalogdaten übernommen. Zum dauerhaften Speichern das Auto speichern.'))
            }}
          >
            {tx('Ausgewählte Daten und Bild übernehmen')}
          </button>
        </div>
      )}
      {message && (
        <p role="status" className="text-sm">
          {tx(message)}
        </p>
      )}
      <CarreraCatalogSettings compact />
    </section>
  )
}
export function CarreraTyres(props) {
  return <CarreraTyresContent key={catalogReference(props.number)} {...props} />
}
function CarreraTyresContent({ number, onAssign }) {
  useExtensions()
  const [data, setData] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const normalized = catalogReference(number)
  const generation = useRef(0)
  useEffect(() => {
    let active = true
    generation.current++
    if (normalized)
      request(`/tyres/${normalized}`)
        .then((v) => {
          if (active) setData(v)
        })
        .catch((e) => {
          if (active) setError(e.message)
        })
    return () => {
      active = false
    }
  }, [normalized])
  async function update() {
    const current = generation.current
    setBusy(true)
    setError('')
    try {
      const value = await request(`/tyres/${normalized}/update`, { method: 'POST' })
      if (generation.current === current) setData(value)
    } catch (e) {
      if (generation.current === current) setError(e.message)
    } finally {
      if (generation.current === current) setBusy(false)
    }
  }
  const otherBrand = /^[CH]/.test(normalized || '')
  return (
    <section
      className="rounded border p-3 space-y-2"
      aria-label={otherBrand ? tx('Passende Scalextric-Reifen') : tx('Passende Carrera-Reifen')}
    >
      <h3 className="font-semibold">{otherBrand ? tx('Passende Scalextric-Reifen') : tx('Passende Carrera-Reifen')}</h3>
      <p className="text-xs text-muted-foreground">
        {tx(
          'Offizielle Ersatzteilzuordnung zur Artikelnummer; gilt für Originalfelgen. Für umgebaute Felgen oder Fremdhersteller ist die Passform damit nicht bestätigt. Bereits eingetragene Reifen werden nur über die Übernahme-Tasten geändert.'
        )}
      </p>
      {normalized && (
        <p className="text-sm">
          {tx('Zugeordnete Fahrzeug-Artikelnummer:')} <strong>{normalized}</strong>
        </p>
      )}
      {!normalized ? (
        <p className="text-sm">{tx('Zum Prüfen zuerst die Fahrzeug-Artikelnummer zuordnen und speichern.')}</p>
      ) : (
        <>
          {!data?.archived && (
            <button type="button" className="rounded border px-3 py-2" disabled={busy} onClick={update}>
              {busy ? tx('Reifenzuordnung wird geprüft …') : tx('Reifenzuordnung online prüfen / aktualisieren')}
            </button>
          )}
          {data && (
            <p className="text-xs">
              {tx('Lokal gespeichert:')} {new Date(data.checkedAt).toLocaleString(locale())} ·{' '}
              <a href={data.sourceUrl} className="underline" target="_blank" rel="noreferrer">
                {tx('Quelle der Reifenzuordnung')}
              </a>
            </p>
          )}
          {data?.parts?.length === 0 && (
            <p className="text-sm">
              {tx(
                'Im gelesenen Ersatzteilbereich wurde kein eindeutig benannter Reifensatz gefunden. Daraus folgt keine Aussage zur tatsächlichen Passform anderer Reifen.'
              )}
            </p>
          )}
          {data?.parts?.map((part) => (
            <div key={part.articleNumber} className="rounded border p-2 space-y-1">
              <strong>
                {tx('Originalreifen') + ' ' + (data.manufacturer || 'Carrera')} {part.articleNumber}
              </strong>
              <p className="text-xs">
                {tx(part.title)}
                {part.packSize ? ` · ${part.packSize} ${tx('Reifen')}` : ''}
              </p>
              <p className="text-xs">
                {part.axle === 'front'
                  ? tx('Vorderreifen')
                  : part.axle === 'rear'
                    ? tx('Hinterreifen')
                    : tx('Vorder-/Hinterachse vom Hersteller hier nicht getrennt angegeben')}
              </p>
              <a className="underline text-sm" href={part.sourceUrl} target="_blank" rel="noreferrer">
                {tx('Quelle der Reifenzuordnung')}
              </a>
              {onAssign && (
                <div className="flex gap-2">
                  {[
                    ['tyresFront', tx('Als Vorderreifen eintragen')],
                    ['tyresRear', tx('Als Hinterreifen eintragen')],
                  ]
                    .filter(
                      ([key]) => !part.axle || (part.axle === 'front' ? key === 'tyresFront' : key === 'tyresRear')
                    )
                    .map(([key, label]) => (
                      <button
                        type="button"
                        key={key}
                        className="rounded border px-2 py-1 text-xs"
                        onClick={() =>
                          onAssign(
                            key,
                            tx('{{v0}} (Originalreifen)', {
                              v0: `${data.manufacturer || 'Carrera'} ${part.articleNumber}`,
                            })
                          )
                        }
                      >
                        {tx(label)}
                      </button>
                    ))}
                </div>
              )}
            </div>
          ))}
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {tx(error)}
        </p>
      )}
    </section>
  )
}
