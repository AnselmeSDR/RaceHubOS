import { useTranslation } from 'react-i18next'
import { GripVertical, X } from 'lucide-react'
import { getImgUrl } from '@/utils/image'
import CarPicture from '../../car/CarPicture'

/** A driver's round picture on their colour, or their number (else initial) without one. */
export function DriverAvatar({ driver, className = 'size-6' }) {
  return (
    <span
      className={`${className} rounded-full shrink-0 overflow-hidden flex items-center justify-center text-[10px] font-bold text-white`}
      style={{ backgroundColor: driver.color || '#6B7280' }}
    >
      {driver.img ? (
        <img src={getImgUrl(driver.img)} alt="" className="size-full object-cover" />
      ) : (
        (driver.number ?? driver.name.charAt(0))
      )}
    </span>
  )
}

/**
 * A participant to drag between sessions: picture, name and car. `drag` holds the drag handlers,
 * `onRemove` adds a button that sets them aside; `dragging` fades it while it moves.
 */
export default function DriverToken({ participant, drag, onRemove, dragging, className = '' }) {
  const { t } = useTranslation('championships')
  const { driver, car } = participant
  return (
    <div
      data-testid="wizard-driver"
      {...drag}
      className={`flex items-center gap-1.5 min-w-0 rounded-md border bg-background px-1.5 py-1 text-xs cursor-grab ${
        dragging ? 'border-primary border-dashed opacity-40' : 'border-border'
      } ${className}`}
    >
      <GripVertical aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" />
      <DriverAvatar driver={driver} className="size-5" />
      <span className="flex-1 min-w-0 truncate">{driver.name}</span>
      {car?.img && <CarPicture car={car} className="w-8 h-5" />}
      {onRemove && (
        <button
          type="button"
          aria-label={t('wizard.setAside', { name: driver.name })}
          onClick={onRemove}
          className="p-0.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  )
}

/**
 * Where a dragged driver would land, shown in the place hovered: their name, the driver they
 * would swap with (`swapWith`), in red when the drop would be refused.
 */
export function DropGhost({ name, swapWith, refused }) {
  return (
    <div
      data-testid="wizard-drop-ghost"
      className={`flex items-center gap-1 rounded-md border-2 border-dashed px-1.5 py-1 text-[11px] font-medium ${
        refused ? 'border-destructive bg-destructive/10 text-destructive' : 'border-primary bg-primary/10 text-primary'
      }`}
    >
      <span aria-hidden="true">{refused ? '✕' : '+'}</span>
      <span className="truncate">{swapWith ? `${name} ⇄ ${swapWith}` : name}</span>
    </div>
  )
}
