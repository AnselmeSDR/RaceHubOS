import { useTranslation } from 'react-i18next'
import { MapPin } from 'lucide-react'
import { FormModal, TextField, PhotoUploadField, ColorPickerField } from '@/components/crud'
import { useEntityForm } from '@/hooks/useEntityForm'

/** Create a track, or edit `track`: name, picture, colour, length and corners. */
export default function TrackFormModal({ track, onClose }) {
  const { t } = useTranslation('tracks')
  const { formData, setField, setError, formProps } = useEntityForm({
    endpoint: '/api/tracks',
    record: track,
    initial: {
      name: track?.name || '',
      length: track?.length || '',
      corners: track?.corners || '',
      img: track?.img || '',
      color: track?.color || '#9333EA',
    },
    toBody: (data) => ({
      name: data.name,
      img: data.img || null,
      length: data.length ? parseFloat(data.length) : null,
      corners: data.corners ? parseInt(data.corners) : null,
      color: data.color,
    }),
    savedMessage: t('form.saved'),
    onClose,
  })

  return (
    <FormModal
      {...formProps}
      title={track ? t('form.editTitle') : t('form.createTitle')}
      icon={<MapPin className="w-5 h-5 text-primary" />}
    >
      <TextField
        label={t('fields.name')}
        value={formData.name}
        onChange={setField('name')}
        placeholder={t('form.namePlaceholder')}
        required
      />
      <PhotoUploadField
        label={t('form.photoLabel')}
        value={formData.img}
        onChange={setField('img')}
        shape="rect"
        onError={setError}
        uploadType="tracks"
      />
      <ColorPickerField value={formData.color} onChange={setField('color')} />
      <div className="grid grid-cols-2 gap-4">
        <TextField
          label={t('form.lengthLabel')}
          type="number"
          value={formData.length}
          onChange={setField('length')}
          placeholder={t('form.lengthPlaceholder')}
        />
        <TextField
          label={t('fields.corners')}
          type="number"
          value={formData.corners}
          onChange={setField('corners')}
          placeholder={t('form.cornersPlaceholder')}
        />
      </div>
    </FormModal>
  )
}
