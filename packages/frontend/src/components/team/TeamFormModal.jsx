import { useTranslation } from 'react-i18next'
import { Users } from 'lucide-react'
import { FormModal, TextField, PhotoUploadField, ColorPickerField } from '@/components/crud'
import { useEntityForm } from '@/hooks/useEntityForm'

/** Create a team, or edit `team`: name, logo and colour. */
export default function TeamFormModal({ team, onClose }) {
  const { t } = useTranslation('teams')
  const { formData, setField, setError, formProps } = useEntityForm({
    endpoint: '/api/teams',
    record: team,
    initial: {
      name: team?.name || '',
      color: team?.color || '#F97316',
      img: team?.img || '',
    },
    savedMessage: t('form.saved'),
    onClose,
  })

  return (
    <FormModal
      {...formProps}
      title={team ? t('form.editTitle') : t('form.createTitle')}
      icon={<Users className="w-5 h-5 text-primary" />}
    >
      <TextField
        label={t('fields.name')}
        value={formData.name}
        onChange={setField('name')}
        placeholder={t('form.namePlaceholder')}
        required
      />
      <PhotoUploadField
        label={t('form.logoLabel')}
        value={formData.img}
        onChange={setField('img')}
        shape="rect"
        onError={setError}
        uploadType="teams"
      />
      <ColorPickerField value={formData.color} onChange={setField('color')} />
    </FormModal>
  )
}
