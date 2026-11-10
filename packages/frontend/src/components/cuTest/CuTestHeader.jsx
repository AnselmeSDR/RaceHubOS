import { useTranslation } from 'react-i18next'
import { Wifi, WifiOff, Zap } from 'lucide-react'
import { modesOf, raceStateOf } from './cuTestModel'

const PILL = 'flex items-center gap-2 px-3 py-1 rounded-full text-sm'
const OFF = 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'

// Socket, Control Unit, start lights, test session and CU modes at a glance
export default function CuTestHeader({ connected, cuConnected, cuStatus, testSession }) {
  const { t } = useTranslation('test')
  const raceState = raceStateOf(cuStatus, t)
  const modes = modesOf(cuStatus, t)
  return (
    <div data-testid="cu-test-header" className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">{t('title')}</h1>
        <div
          className={`${PILL} ${
            connected
              ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
              : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
          }`}
        >
          {connected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          {connected ? t('status.socketOk') : t('status.socketOff')}
        </div>
        <div
          className={`${PILL} ${cuConnected ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : OFF}`}
        >
          <Zap className="w-4 h-4" />
          {cuConnected ? t('status.cuConnected') : t('status.cuOffline')}
        </div>
        {cuConnected && (
          <div
            className={`px-3 py-1 rounded-full text-sm font-bold bg-${raceState.color}-100 text-${raceState.color}-700`}
          >
            {raceState.text}
          </div>
        )}
        <div
          className={`${PILL} ${
            testSession ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300' : OFF
          }`}
        >
          {testSession ? t('status.session', { id: testSession.id.substring(0, 8) }) : t('status.noSession')}
        </div>
        {modes.length > 0 && (
          <div className="flex gap-1">
            {modes.map((m) => (
              <span
                key={m}
                className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded"
              >
                {m}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
