import { catalogReference } from '@racehubos/shared'
import { tx, useExtensions, locale } from '../../i18n/extensions'
import { useEffect, useState } from 'react'
import { CarreraTyres } from './CarreraCatalog'

// Explicit per-car assignments are part of the native backup; never infer fit from a model name.
export default function CarTyres(props) {
  return <CarTyresContent key={props.carId || ''} {...props} />
}
function CarTyresContent({ carId, number, onAssign }) {
  useExtensions()
  const [assignment, setAssignment] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(Boolean(carId))
  useEffect(() => {
    const controller = new AbortController()
    if (carId)
      (async () => {
        try {
          const response = await fetch(
            `${import.meta.env.VITE_API_URL || ''}/api/preferences/${encodeURIComponent(`car:compatibleTyres:${carId}`)}`,
            { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) }
          )
          const body = await response.json()
          if (!response.ok || !body.success) throw new Error(tx('Reifenzuordnung konnte nicht geladen werden.'))
          if (!controller.signal.aborted) setAssignment(body.data)
        } catch (e) {
          if (!controller.signal.aborted) setError(e.message)
        } finally {
          if (!controller.signal.aborted) setLoading(false)
        }
      })()
    return () => controller.abort()
  }, [carId])
  if (loading)
    return (
      <p role="status" className="text-sm">
        {tx('Passende Reifen werden geladen …')}
      </p>
    )
  const assignedNumber = catalogReference(number)
  const matchesAssignment = !assignedNumber || assignment?.reference?.split(/\s*\/\s*/).includes(assignedNumber)
  if (!assignment?.parts?.length || !matchesAssignment)
    return (
      <>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {tx(error)}
          </p>
        )}
        <CarreraTyres number={number} onAssign={onAssign} />
      </>
    )
  return (
    <section aria-label={tx('Passende Scalextric-Reifen')} className="rounded border p-3 space-y-2">
      <h3 className="font-semibold">
        {tx('Passende {{manufacturer}}-Reifen', { manufacturer: assignment.manufacturer })}
      </h3>
      <p className="text-sm">
        {tx('Fahrzeug-Artikelnummer:')} <strong>{assignment.reference}</strong>
      </p>
      <p className="text-xs text-muted-foreground">
        {tx(
          'Geprüfte Ersatzreifen für Originalfelgen. Die tatsächlich montierten Reifen werden dadurch nicht bestimmt. Vorhandene Reifeneinträge werden nur über die Übernahme-Tasten geändert.'
        )}
      </p>
      <p className="text-xs">
        {tx('Lokal gespeichert:')} {new Date(assignment.checkedAt).toLocaleDateString(locale())}
      </p>
      {assignment.parts.map((part) => (
        <div key={part.articleNumber} className="rounded border p-2 space-y-1">
          <strong>
            {tx('Originalreifen')} {assignment.manufacturer} {part.articleNumber}
          </strong>
          <p className="text-sm">
            {tx(part.title)} · {part.packSize} {tx('Reifen')}
          </p>
          <a className="underline text-sm" href={part.sourceUrl} target="_blank" rel="noreferrer">
            {tx('Quelle der Reifenzuordnung')}
          </a>
          {onAssign && (
            <div className="flex gap-2 flex-wrap">
              {[
                ['tyresFront', tx('Als Vorderreifen eintragen')],
                ['tyresRear', tx('Als Hinterreifen eintragen')],
              ].map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  className="rounded border px-2 py-1 text-xs"
                  onClick={() =>
                    onAssign(
                      key,
                      tx('{{v0}} (Originalreifen)', { v0: `${assignment.manufacturer} ${part.articleNumber}` })
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
    </section>
  )
}
