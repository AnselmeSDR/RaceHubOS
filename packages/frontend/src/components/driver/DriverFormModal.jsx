import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { User } from 'lucide-react'
import { DivisionScope } from '@racehubos/shared'
import { FormField, FormModal, TextField, PhotoUploadField, ColorPickerField } from '@/components/crud'
import DivisionPicker from '@/components/division/DivisionPicker'
import { useDivisions } from '@/hooks/useDivisions'
import { useEntityForm } from '@/hooks/useEntityForm'
import { getData } from '@/lib/sessionApi'
import CarSelect from '../car/CarSelect'

/**
 * Create a driver, or edit `driver`: name, number, email, picture, colour, divisions and the
 * preferred car, offered when the driver joins a championship.
 */
export default function DriverFormModal({ driver, onClose }) {
  const { t } = useTranslation('drivers')
  const divisions = useDivisions(DivisionScope.DRIVER)
  const [cars, setCars] = useState([])
  useEffect(() => {
    getData('/api/cars?limit=1000').then((data) => setCars(data ?? []))
  }, [])
  const { formData, setFormData, setField, setError, formProps } = useEntityForm({
    endpoint: '/api/drivers',
    record: driver,
    initial: {
      name: driver?.name || '',
      number: driver?.number || '',
      email: driver?.email || '',
      img: driver?.img || '',
      color: driver?.color || '#3B82F6',
      divisionIds: driver?.divisions?.map((division) => division.id) ?? [],
      preferredCarId: driver?.preferredCarId || null,
    },
    savedMessage: t('form.saved'),
    onClose,
  })

  return (
    <FormModal
      {...formProps}
      title={driver ? t('form.editTitle') : t('form.createTitle')}
      icon={<User className="w-5 h-5 text-primary" />}
    >
      <TextField
        label={t('form.name')}
        value={formData.name}
        onChange={setField('name')}
        placeholder={t('form.namePlaceholder')}
        required
      />
      <div className="grid grid-cols-2 gap-4">
        <TextField
          label={t('form.number')}
          type="number"
          value={formData.number}
          onChange={(v) => setFormData((f) => ({ ...f, number: v ? parseInt(v) : '' }))}
          placeholder={t('form.numberPlaceholder')}
        />
        <TextField
          label={t('form.email')}
          type="email"
          value={formData.email}
          onChange={setField('email')}
          placeholder={t('form.emailPlaceholder')}
        />
      </div>
      <PhotoUploadField
        value={formData.img}
        onChange={setField('img')}
        shape="round"
        onError={setError}
        uploadType="drivers"
      />
      <ColorPickerField value={formData.color} onChange={setField('color')} />
      <FormField label={t('glossary:division', { count: 2 })}>
        <DivisionPicker
          testId="driver-divisions"
          divisions={divisions}
          value={formData.divisionIds}
          onChange={setField('divisionIds')}
          label={t('divisions:addDivision')}
        />
        <p className="text-xs text-muted-foreground mt-1">{t('divisions:pickerHint')}</p>
      </FormField>
      <FormField label={t('form.preferredCar')}>
        <CarSelect
          cars={cars}
          value={formData.preferredCarId}
          onChange={setField('preferredCarId')}
          label={t('form.preferredCar')}
          noneLabel={t('form.noPreferredCar')}
        />
        <p className="text-xs text-muted-foreground mt-1">{t('form.preferredCarHint')}</p>
      </FormField>
    </FormModal>
  )
}
