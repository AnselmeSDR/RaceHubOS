import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Users } from 'lucide-react'
import PageHeader, { ViewToggleButtons } from '@/components/crud/PageHeader'
import EmptyState from '@/components/crud/EmptyState'
import EntityCard, { StatBadge } from '@/components/crud/EntityCard'
import ColorPickerField from '@/components/crud/ColorPickerField'
import { FormField, TextField } from '@/components/crud/FormModal'
import RangeField from '@/components/crud/RangeField'
import Modal, { ModalFooter, ModalButton } from '@/components/ui/Modal'
import ErrorMessage from '@/components/ErrorMessage'
import SectionHeader from './SectionHeader'
import LoadingState from './LoadingState'

export default function CRUDDisplays({ drivers, loading }) {
  const { t } = useTranslation('displays')
  const [showModal, setShowModal] = useState(false)
  const [view, setView] = useState('grid')

  if (loading) return <LoadingState />

  const demoDriver = drivers[0]

  return (
    <>
      {/* PageHeader */}
      <section>
        <SectionHeader
          title={t('crud.pageHeader.title')}
          description={t('crud.pageHeader.description')}
          componentName="PageHeader"
          code="<PageHeader />"
        />
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <PageHeader
            title={t('glossary:driver_other')}
            searchValue=""
            onSearchChange={() => {}}
            onAdd={() => setShowModal(true)}
            addLabel={t('crud.addDriver')}
          />
        </div>
      </section>

      {/* ViewToggleButtons */}
      <section>
        <SectionHeader
          title={t('crud.viewToggleButtons.title')}
          description={t('crud.viewToggleButtons.description')}
          componentName="ViewToggleButtons"
          code="<ViewToggleButtons />"
        />
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <ViewToggleButtons mode={view} onChange={setView} />
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {t('crud.viewToggleButtons.currentView', { view })}
          </p>
        </div>
      </section>

      {/* EmptyState */}
      <section>
        <SectionHeader
          title={t('crud.emptyState.title')}
          description={t('crud.emptyState.description')}
          componentName="EmptyState"
          code="<EmptyState />"
        />
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <EmptyState
            icon={<Users className="w-8 h-8" />}
            title={t('crud.emptyState.demoTitle')}
            message={t('crud.emptyState.demoMessage')}
            actionLabel={t('crud.addDriver')}
            onAction={() => {}}
          />
        </div>
      </section>

      {/* EntityCard */}
      <section>
        <SectionHeader
          title={t('crud.entityCard.title')}
          description={t('crud.entityCard.description')}
          componentName="EntityCard"
          code="<EntityCard />"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {drivers.slice(0, 3).map((driver) => (
            <EntityCard
              key={driver.id}
              image={driver.img}
              title={driver.name}
              subtitle={driver.divisions?.map((d) => d.name).join(', ') || t('crud.noDivision')}
              color={driver.color}
              onClick={() => {}}
              onEdit={() => {}}
              onDelete={() => {}}
            >
              <StatBadge label={t('crud.statRaces')} value={driver._count?.sessions || 0} />
              <StatBadge label={t('crud.statLaps')} value={driver._count?.laps || 0} />
            </EntityCard>
          ))}
        </div>
      </section>

      {/* StatBadge */}
      <section>
        <SectionHeader
          title={t('crud.statBadge.title')}
          description={t('crud.statBadge.description')}
          componentName="StatBadge"
          code="<StatBadge label='Tours' value={42} />"
        />
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow flex gap-4">
          <StatBadge label={t('crud.statRaces')} value={15} />
          <StatBadge label={t('crud.statLaps')} value={234} />
          <StatBadge label={t('crud.statWins')} value={3} />
          <StatBadge label={t('crud.statPodiums')} value={8} />
        </div>
      </section>

      {/* ColorPickerField */}
      <section>
        <SectionHeader
          title={t('crud.colorPickerField.title')}
          description={t('crud.colorPickerField.description')}
          componentName="ColorPickerField"
          code="<ColorPickerField />"
        />
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow max-w-md">
          <ColorPickerField
            label={t('crud.colorPickerField.label')}
            value={demoDriver?.color || '#3B82F6'}
            onChange={() => {}}
          />
        </div>
      </section>

      {/* RangeField */}
      <section>
        <SectionHeader
          title={t('crud.rangeField.title')}
          description={t('crud.rangeField.description')}
          componentName="RangeField"
          code="<RangeField />"
        />
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow max-w-md">
          <RangeField label={t('crud.rangeField.label')} value={80} onChange={() => {}} min={0} max={100} />
        </div>
      </section>

      {/* ErrorMessage */}
      <section>
        <SectionHeader
          title={t('crud.errorMessage.title')}
          description={t('crud.errorMessage.description')}
          componentName="ErrorMessage"
          code="<ErrorMessage message='...' />"
        />
        <div className="space-y-4">
          <ErrorMessage message={t('crud.errorMessage.demoMessage')} />
        </div>
      </section>

      {/* Modal Demo */}
      {showModal && (
        <Modal title={t('crud.modalTitle')} onClose={() => setShowModal(false)}>
          <p className="text-gray-600 mb-4">{t('crud.modalContent')}</p>
          <FormField label={t('crud.modalFieldName')}>
            <TextField value="" onChange={() => {}} placeholder={t('crud.modalFieldNamePlaceholder')} />
          </FormField>
          <ModalFooter>
            <ModalButton variant="secondary" onClick={() => setShowModal(false)}>
              {t('common:cancel')}
            </ModalButton>
            <ModalButton variant="primary" onClick={() => setShowModal(false)}>
              {t('common:save')}
            </ModalButton>
          </ModalFooter>
        </Modal>
      )}
    </>
  )
}
