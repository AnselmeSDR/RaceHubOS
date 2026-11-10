import { useTranslation } from 'react-i18next'
import { Play, RefreshCw, Settings, Square, Wifi, X } from 'lucide-react'
import { CU_BUTTONS } from '@/constants'

const BUTTON = 'flex items-center gap-1 px-3 py-2 text-white rounded-lg disabled:opacity-50'

// The Control Unit's commands once connected, the scan before
export default function CuControls({
  cuConnected,
  cuStatus,
  scanning,
  busy,
  showConfig,
  onScan,
  onCommand,
  onInfo,
  onDisconnect,
  onToggleConfig,
}) {
  const { t } = useTranslation('test')
  const racing = cuStatus?.start === 0
  return (
    <div data-testid="cu-test-controls" className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-700 dark:text-gray-200">{t('cu.title')}</span>
          {!cuConnected ? (
            <button
              onClick={onScan}
              disabled={scanning}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {scanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
              {t('cu.scanConnect')}
            </button>
          ) : (
            <>
              {/* The same command starts and stops the race */}
              {racing ? (
                <button
                  onClick={() => onCommand('/start-race')}
                  disabled={busy}
                  className={`${BUTTON} px-4 bg-red-600 hover:bg-red-700 font-bold`}
                >
                  <Square className="w-5 h-5" />
                  {t('cu.stop')}
                </button>
              ) : (
                <button
                  onClick={() => onCommand('/start-race')}
                  disabled={busy}
                  className={`${BUTTON} bg-green-600 hover:bg-green-700`}
                >
                  <Play className="w-4 h-4" />
                  {t('cu.start')}
                </button>
              )}
              <button
                onClick={() => onCommand('/esc')}
                disabled={busy}
                className={`${BUTTON} bg-gray-500 hover:bg-gray-600`}
              >
                {t('cu.esc')}
              </button>
              <button
                onClick={() => onCommand('/reset-timer')}
                disabled={busy}
                className={`${BUTTON} bg-orange-600 hover:bg-orange-700`}
              >
                <RefreshCw className="w-4 h-4" />
                {t('cu.resetTimer')}
              </button>
              <button
                onClick={() => onCommand('/clear-position')}
                disabled={busy}
                className={`${BUTTON} bg-purple-600 hover:bg-purple-700`}
              >
                {t('cu.clearPos')}
              </button>
              <button onClick={onInfo} disabled={busy} className={`${BUTTON} bg-teal-600 hover:bg-teal-700`}>
                {t('cu.info')}
              </button>

              <div className="border-l dark:border-gray-600 pl-2 ml-2 flex gap-1">
                {Object.entries(CU_BUTTONS).map(([name, id]) => (
                  <button
                    key={id}
                    onClick={() => onCommand(`/button/${id}`)}
                    disabled={busy}
                    className="px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50 text-xs"
                    title={t('cu.buttonTitle', { id, name })}
                  >
                    {name}
                  </button>
                ))}
              </div>

              <button onClick={onDisconnect} disabled={busy} className={`${BUTTON} bg-gray-600 hover:bg-gray-700 ml-2`}>
                <X className="w-4 h-4" />
                {t('cu.disconnect')}
              </button>
            </>
          )}
        </div>

        {cuConnected && cuStatus && (
          <div className="text-xs text-gray-500 dark:text-gray-400 flex gap-4">
            <span>{t('cu.display', { count: cuStatus.display || 6 })}</span>
            {cuStatus.fuel && (
              <span>{t('cu.fuel', { values: cuStatus.fuel.slice(0, cuStatus.display || 6).join(', ') })}</span>
            )}
          </div>
        )}

        <button
          onClick={onToggleConfig}
          aria-pressed={showConfig}
          className={`flex items-center gap-1 px-3 py-2 rounded-lg ${showConfig ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'} hover:bg-blue-200 dark:hover:bg-blue-900/70`}
        >
          <Settings className="w-4 h-4" />
          {t('config.toggle')}
        </button>
      </div>
    </div>
  )
}
