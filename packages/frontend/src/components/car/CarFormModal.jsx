import { useTranslation } from 'react-i18next'
import { Car } from 'lucide-react'
import { CAR_NUMBER_SPECS, CAR_SPECS, CAR_TEXT_SPECS } from '@racehubos/shared'
import { FormModal, TextField, PhotoUploadField, ColorPickerField } from '@/components/crud'
import { FormSection } from '@/components/crud/FormModal'
import { useEntityForm } from '@/hooks/useEntityForm'
import CarLevelField from './CarLevelField'

/** Create a car, or edit `car`: identity, picture, colour, Control Unit settings and specs. */
export default function CarFormModal({ car, onClose }) {
  const { t } = useTranslation('cars')
  const { formData, setFormData, setField, setError, formProps } = useEntityForm({
    endpoint: '/api/cars',
    record: car,
    initial: {
      brand: car?.brand || '',
      model: car?.model || '',
      // A new car starts at this year; an existing one keeps its year, even none
      year: car ? (car.year ?? null) : new Date().getFullYear(),
      color: car?.color || '#22C55E',
      maxSpeed: car?.maxSpeed || 100,
      brakeForce: car?.brakeForce || 50,
      fuelCapacity: car?.fuelCapacity || 100,
      img: car?.img || '',
      ...Object.fromEntries(CAR_SPECS.map((field) => [field, car?.[field] ?? ''])),
    },
    savedMessage: t('form.saved'),
    onClose,
  })

  return (
    <FormModal
      {...formProps}
      title={car ? t('form.editTitle') : t('form.createTitle')}
      icon={<Car className="w-5 h-5 text-primary" />}
    >
      <div className="grid grid-cols-2 gap-4">
        <TextField
          label={t('fields.brand')}
          value={formData.brand}
          onChange={setField('brand')}
          placeholder={t('form.brandPlaceholder')}
          required
        />
        <TextField
          label={t('fields.model')}
          value={formData.model}
          onChange={setField('model')}
          placeholder={t('form.modelPlaceholder')}
          required
        />
      </div>
      <TextField
        label={t('fields.year')}
        type="number"
        value={formData.year}
        onChange={(v) => setFormData((f) => ({ ...f, year: parseInt(v) || null }))}
      />
      <PhotoUploadField
        value={formData.img}
        onChange={setField('img')}
        shape="rect"
        onError={setError}
        uploadType="cars"
      />
      <ColorPickerField value={formData.color} onChange={setField('color')} />
      <CarLevelField
        label={t('fields.maxSpeed')}
        value={formData.maxSpeed}
        onChange={setField('maxSpeed')}
        color="#22C55E"
      />
      <CarLevelField
        label={t('fields.brakeForce')}
        value={formData.brakeForce}
        onChange={setField('brakeForce')}
        color="#EF4444"
      />
      <CarLevelField
        label={t('fields.fuelCapacity')}
        value={formData.fuelCapacity}
        onChange={setField('fuelCapacity')}
        color="#3B82F6"
      />

      <FormSection title={t('fields.equipment')}>
        <div className="grid grid-cols-2 gap-4">
          {CAR_TEXT_SPECS.filter((field) => field !== 'notes').map((field) => (
            <TextField
              key={field}
              label={t(`fields.${field}`)}
              value={formData[field]}
              onChange={setField(field)}
              placeholder={t(`form.${field}Placeholder`, '')}
            />
          ))}
        </div>
      </FormSection>

      <FormSection title={t('fields.measurements')}>
        <div className="grid grid-cols-3 gap-4">
          {CAR_NUMBER_SPECS.map((field) => (
            <TextField
              key={field}
              label={t(`fields.${field}`)}
              type="number"
              value={formData[field]}
              onChange={setField(field)}
            />
          ))}
        </div>
      </FormSection>

      <TextField label={t('fields.notes')} value={formData.notes} onChange={setField('notes')} multiline />
    </FormModal>
  )
}
