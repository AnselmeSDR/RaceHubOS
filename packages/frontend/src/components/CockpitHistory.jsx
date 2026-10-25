import { useEffect, useMemo, useState } from 'react'
import { tx, useExtensions } from '../i18n/cockpit'

const kinds = {
  StRennResults: 'Rennergebnisse',
  StMoreRecords: 'Rekorde und Sektorwerte',
  StRoundTime: 'Rundenzeiteinträge',
  StRennCounter: 'Gesamtstände',
  StWinnerItems: 'Rennen und Siege',
}
const fields = {
  Runden: 'Runden',
  Gesamtzeit: 'Gesamtzeitwert',
  BesteRunde: 'Bester Rundenzeitwert',
  Platz: 'Platz',
  Recordtime: 'Zeitwert',
  Sector: 'Sektorcode',
  TopSpeedSector: 'Geschwindigkeits-Sektorcode',
  TopSpeedValue: 'Geschwindigkeitswert',
  RoundTime: 'Rundenzeitwert',
  Slot: 'Spurcode',
  Totaltime: 'Fahrzeitwert',
  Totaldistance: 'Streckenwert',
  Totalround: 'Runden',
  AnzahlRennen: 'Rennen',
  AnzahlSiege: 'Siege',
}
const serviceFields = {
  Runden: 'Serviceintervall in Runden',
  RundenService: 'Gespeicherter Service-Rundenstand',
  Strecke: 'Serviceintervall Strecke',
  StreckeService: 'Gespeicherter Service-Streckenwert',
  Fahrzeit: 'Serviceintervall Fahrzeit',
  FahrzeitService: 'Gespeicherter Service-Fahrzeitwert',
  ServiceTermin: 'Servicetermin',
  TerminService: 'Gespeicherter Servicetermin',
}
const dateLabel = (value) =>
  /^\d{8}$/.test(String(value || ''))
    ? `${String(value).slice(6, 8)}.${String(value).slice(4, 6)}.${String(value).slice(0, 4)}`
    : value || '—'

export default function CockpitHistory({ carId, driverId }) {
  useExtensions()
  const [archive, setArchive] = useState(null),
    [error, setError] = useState(''),
    [query, setQuery] = useState(''),
    [kind, setKind] = useState(''),
    [limit, setLimit] = useState(50)
  useEffect(() => {
    const controller = new AbortController()
    fetch(`${import.meta.env.VITE_API_URL || ''}/api/data/cockpit/history`, { signal: controller.signal })
      .then(async (r) => {
        const body = await r.json()
        if (!r.ok || !body.success) throw new Error(tx('Cockpit-XP-Historie konnte nicht geladen werden.'))
        setArchive(body.data)
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message)
      })
    return () => controller.abort()
  }, [carId, driverId])
  const car = archive?.cars?.find((c) => c.carId === carId)
  const all = useMemo(
    () =>
      (archive?.records || []).filter((r) => (!carId || r.carId === carId) && (!driverId || r.driverId === driverId)),
    [archive, carId, driverId]
  )
  const rows = useMemo(
    () =>
      all.filter(
        (r) =>
          (!kind || r.kind === kind) &&
          (!query ||
            `${r.driverName} ${r.carName} ${r.trackName} ${r.raw.Date || r.raw.Datum || ''}`
              .toLocaleLowerCase()
              .includes(query.toLocaleLowerCase()))
      ),
    [all, kind, query]
  )
  if (error)
    return (
      <p role="alert" className="p-3 text-sm text-red-600">
        {error}
      </p>
    )
  if (!car && !all.length) return null
  return (
    <section className="rounded-xl border bg-card p-4 space-y-3" aria-label={tx('Cockpit-XP-Historie')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{tx('Cockpit-XP-Historie')}</h2>
        <span className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-900">
          {tx('Historische Daten · Cockpit-XP')}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {tx(
          'Getrennt von aktuellen RaceHubOS-Ergebnissen. Alte Stände beschreiben den Zeitpunkt der Cockpit-XP-Sicherung und ändern keine aktuellen Einstellungen. Zeit-, Strecken- und Sektorwerte bleiben in den Originaleinheiten; sie werden nicht ungeprüft umgerechnet.'
        )}
      </p>
      {car && (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="font-medium">{tx('Fahrzeugtechnik aus Cockpit-XP')}</h3>
            <dl className="mt-2 space-y-1 text-sm">
              {Object.entries(car.technology || {}).map(([key, value]) => (
                <div className="flex flex-wrap gap-2" key={key}>
                  <dt className="text-muted-foreground">{tx(key)}:</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            {car.inUseSince && (
              <p className="mt-2 text-sm">
                {tx('Im Einsatz seit')}: {car.inUseSince}
              </p>
            )}
          </div>
          {car.service && (
            <div>
              <h3 className="font-medium">{tx('Wartungsstand aus Cockpit-XP')}</h3>
              <p className="text-xs text-muted-foreground">
                {tx(car.service.active ? 'Serviceüberwachung war aktiviert' : 'Serviceüberwachung war deaktiviert')}
              </p>
              <dl className="mt-2 space-y-1 text-sm">
                {Object.entries(car.service.values)
                  .filter(([, value]) => value && !value.includes('1899'))
                  .map(([key, value]) => (
                    <div className="flex flex-wrap gap-2" key={key}>
                      <dt className="text-muted-foreground">{tx(serviceFields[key] || key)}:</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          )}
        </div>
      )}
      <details>
        <summary className="cursor-pointer font-medium">
          {tx('Historische Statistiken anzeigen')} ({all.length})
        </summary>
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            <input
              className="rounded border bg-background p-2 text-sm"
              aria-label={tx('Historie durchsuchen')}
              placeholder={tx('Fahrer, Auto, Strecke oder Datum suchen')}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setLimit(50)
              }}
            />
            <select
              className="rounded border bg-background p-2 text-sm"
              aria-label={tx('Statistikart')}
              value={kind}
              onChange={(e) => {
                setKind(e.target.value)
                setLimit(50)
              }}
            >
              <option value="">{tx('Alle Statistikarten')}</option>
              {Object.entries(kinds).map(([value, label]) => (
                <option key={value} value={value}>
                  {tx(label)}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs">
            {tx('Einträge')}: {rows.length}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  {['Datum', 'Art', 'Fahrer', 'Auto', 'Strecke', 'Originalwerte'].map((h) => (
                    <th className="p-2" key={h}>
                      {tx(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, limit).map((row) => (
                  <tr className="border-b align-top" key={row.key}>
                    <td className="whitespace-nowrap p-2">
                      {dateLabel(row.raw.Date || row.raw.Datum || row.raw.LastRunDate)}
                    </td>
                    <td className="p-2">{tx(kinds[row.kind])}</td>
                    <td className="p-2">{row.driverName || '—'}</td>
                    <td className="p-2">{row.carName || '—'}</td>
                    <td className="p-2">{row.trackName || '—'}</td>
                    <td className="p-2">
                      <dl>
                        {Object.entries(fields)
                          .filter(([key]) => row.raw[key] !== undefined && row.raw[key] !== null)
                          .map(([key, label]) => (
                            <div className="whitespace-nowrap" key={key}>
                              <dt className="inline text-muted-foreground">{tx(label)}: </dt>
                              <dd className="inline font-mono">{row.raw[key] === -1 ? '—' : row.raw[key]}</dd>
                            </div>
                          ))}
                      </dl>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > limit && (
            <button className="rounded border px-3 py-2" onClick={() => setLimit((n) => n + 50)}>
              {tx('Weitere Einträge anzeigen')}
            </button>
          )}
        </div>
      </details>
    </section>
  )
}
