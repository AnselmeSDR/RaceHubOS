import { useTranslation } from 'react-i18next'
import { Medal } from 'lucide-react'
import { DivisionScope } from '@racehubos/shared'
import { FormField, FormModal, TextField, PhotoUploadField, ColorPickerField } from '@/components/crud'
import { useEntityForm } from '@/hooks/useEntityForm'
import DivisionBadge from './DivisionBadge'

/** Without a rank, a new division goes last: the server decides. */
const toBody = ({ order, ...data }) => (order === '' ? data : { ...data, order: Number(order) })
/** A rank is a whole number from 0, or empty. */
const isRank = (order) => order === '' || (Number.isInteger(Number(order)) && Number(order) >= 0)

/** Create a division of `scope`, or edit `division`: name, short name, logo, colour and rank. */
export default function DivisionFormModal({ division, scope, onClose }) {
  const { t } = useTranslation('divisions')
  const category = scope === DivisionScope.CAR
  const { formData, setField, setError, formProps } = useEntityForm({
    endpoint: '/api/divisions',
    record: division,
    initial: {
      scope,
      name: division?.name || '',
      shortName: division?.shortName || '',
      color: division?.color || '#6B7280',
      img: division?.img || '',
      order: division?.order ?? '',
    },
    toBody,
    savedMessage: t('form.saved'),
    onClose,
  })
  const kind = category ? 'Category' : 'Division'
  const orderError = isRank(formData.order) ? undefined : t('form.orderInvalid')

  return (
    <FormModal
      {...formProps}
      onSubmit={orderError ? undefined : formProps.onSubmit}
      title={t(division ? `form.edit${kind}` : `form.create${kind}`)}
      icon={<Medal className="w-5 h-5 text-primary" />}
    >
      <div className="grid grid-cols-2 gap-4">
        <TextField
          label={t('form.name')}
          value={formData.name}
          onChange={setField('name')}
          placeholder={category ? 'GT3' : 'GOLD'}
          required
        />
        <div>
          <TextField
            label={t('form.shortName')}
            value={formData.shortName}
            onChange={setField('shortName')}
            placeholder={formData.name}
          />
          <p className="text-xs text-muted-foreground mt-1">{t('form.shortNameHint')}</p>
        </div>
      </div>
      <PhotoUploadField
        label={t('form.logo')}
        value={formData.img}
        onChange={setField('img')}
        shape="rect"
        onError={setError}
        uploadType="divisions"
      />
      <ColorPickerField value={formData.color} onChange={setField('color')} />
      <div>
        <TextField
          label={t(category ? 'form.order' : 'form.rank')}
          type="number"
          value={formData.order}
          onChange={setField('order')}
          error={orderError}
        />
        <p className="text-xs text-muted-foreground mt-1">{t(category ? 'form.orderHint' : 'form.rankHint')}</p>
      </div>
      <FormField label={t('form.preview')}>
        <div className="flex items-center gap-2" data-testid="division-preview">
          <DivisionBadge division={{ ...formData, name: formData.name || '—' }} />
          <DivisionBadge division={{ ...formData, name: formData.name || '—' }} large />
        </div>
      </FormField>
    </FormModal>
  )
}
