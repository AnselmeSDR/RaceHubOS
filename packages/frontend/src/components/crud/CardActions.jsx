import { useTranslation } from 'react-i18next'
import { Pencil } from 'lucide-react'
import DeleteButton from '@/components/ui/DeleteButton'

/** Edit (when `onEdit` is given) and delete, in the top right corner of a list card. */
export default function CardActions({ onEdit, onDelete }) {
  const { t } = useTranslation('common')
  return (
    <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
      {onEdit && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
          className="p-1.5 rounded-lg bg-black/20 hover:bg-black/40 text-white transition-colors"
          aria-label={t('edit')}
        >
          <Pencil className="size-3.5" />
        </button>
      )}
      <DeleteButton onDelete={onDelete} />
    </div>
  )
}
