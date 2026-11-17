import { useTranslation } from 'react-i18next'
import ConnectionLogs from './ConnectionLogs'
import ConnectionStatus from './ConnectionStatus'
import CuStatusCard from './CuStatusCard'
import DeviceList from './DeviceList'
import SettingsPanel from './SettingsPanel'

/**
 * Everything about the Control Unit in one panel: its state in the title, the known units, the
 * automatic connection, the search for another one, what a connected unit reports, and the log folded.
 */
export default function ControlUnitPanel({ logs, onLog, onClearLogs }) {
  const { t } = useTranslation('settings')
  return (
    <SettingsPanel title={t('cu.title')} state={<ConnectionStatus />} testId="settings-control-unit">
      <DeviceList onLog={onLog} />
      <CuStatusCard />
      <ConnectionLogs logs={logs} onClear={onClearLogs} />
    </SettingsPanel>
  )
}
