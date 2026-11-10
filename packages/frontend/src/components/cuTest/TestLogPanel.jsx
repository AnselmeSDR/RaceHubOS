import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import TestLogLine from './TestLogLine'
import { LOG_TYPES, filterLogs, groupLogs, logColor } from './cuTestModel'

const FILTERS = [
  ['all', 'logs.filterAll'],
  ['lap', 'logs.filterLap'],
  ['status', 'logs.filterStatus'],
  ['error', 'logs.filterError'],
  ['success', 'logs.filterSuccess'],
  ['info', 'logs.filterInfo'],
]

// The event log, in order or grouped by kind; it follows the newest line
export default function TestLogPanel({ logs, onClear }) {
  const { t } = useTranslation('test')
  const [filter, setFilter] = useState('all')
  const [grouped, setGrouped] = useState(false)
  const endRef = useRef(null)
  const shown = filterLogs(logs, filter)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const label = (type) => t(`logs.type${type[0].toUpperCase()}${type.slice(1)}`)
  const groups = grouped ? groupLogs(shown) : null

  return (
    <div data-testid="cu-test-logs" className="col-span-2 bg-gray-900 rounded-lg flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-white font-semibold">{t('logs.title')}</span>
          <span className="text-gray-400 text-sm">({shown.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setGrouped(!grouped)}
            className={`px-2 py-1 text-sm rounded ${grouped ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 border border-gray-700'}`}
          >
            {grouped ? t('logs.grouped') : t('logs.chrono')}
          </button>
          {!grouped && (
            <select
              aria-label={t('logs.title')}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-gray-800 text-white text-sm rounded px-2 py-1 border border-gray-700"
            >
              {FILTERS.map(([value, key]) => (
                <option key={value} value={value}>
                  {t(key)}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={onClear}
            className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
            title={t('logs.clearTitle')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 font-mono text-xs">
        {shown.length === 0 ? (
          <div className="text-gray-500 text-center py-8">{t('logs.waiting')}</div>
        ) : groups ? (
          <div className="space-y-4">
            {LOG_TYPES.filter((type) => groups[type]).map((type) => (
              <div key={type} data-testid="cu-test-log-group">
                <div
                  className={`sticky top-0 py-1 px-2 rounded font-bold uppercase text-xs mb-1 ${logColor(type)} bg-gray-800`}
                >
                  {t('logs.groupCount', { type: label(type), count: groups[type].length })}
                </div>
                <div className="space-y-1 pl-2 border-l-2 border-gray-700">
                  {groups[type].map((log, i) => (
                    <TestLogLine key={i} log={log} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {shown.map((log, i) => (
              <TestLogLine key={i} log={log} />
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  )
}
