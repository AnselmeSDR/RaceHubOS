import CarPicture from './CarPicture'

const carLabel = (car) => `${car.brand} ${car.model}`

/**
 * A car among `cars`, its picture beside the list; `noneLabel` names the empty choice and
 * `describe(car)` adds a hint to an option (who else runs it).
 */
export default function CarSelect({ cars, value, onChange, noneLabel, label, describe, className = '' }) {
  const car = cars.find((c) => c.id === value)
  return (
    <div className={`flex items-center gap-2 min-w-0 ${className}`}>
      {car?.img ? (
        <CarPicture car={car} className="size-7" />
      ) : (
        <span aria-hidden="true" className="size-7 shrink-0 rounded-[20%] border border-dashed border-border" />
      )}
      <select
        aria-label={label}
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="flex-1 min-w-0 px-2 py-1 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">{noneLabel}</option>
        {cars.map((c) => {
          const hint = describe?.(c)
          return (
            <option key={c.id} value={c.id}>
              {hint ? `${carLabel(c)} · ${hint}` : carLabel(c)}
            </option>
          )
        })}
      </select>
    </div>
  )
}
