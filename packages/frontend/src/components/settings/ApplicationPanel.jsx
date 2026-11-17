import { useTranslation } from 'react-i18next'
import { useApp } from '@/context/AppContext'
import SettingSwitch from './SettingSwitch'
import SettingsPanel, { SettingRow } from './SettingsPanel'
import UpdateSection from './UpdateSection'

/** The app itself: its version and updates, and the admin mode, which says what it opens. */
export default function ApplicationPanel() {
  const { t } = useTranslation('settings')
  const { isAdmin, toggleAdmin } = useApp()
  return (
    <SettingsPanel title={t('application.title')} testId="settings-application">
      <UpdateSection />
      <SettingRow label={t('appearance.adminMode')} description={t('appearance.adminModeDesc')}>
        <SettingSwitch on={isAdmin} onToggle={toggleAdmin} label={t('appearance.adminMode')} />
      </SettingRow>
    </SettingsPanel>
  )
}
