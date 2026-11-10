import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import { useNow } from '@/hooks/useNow'
import { formatSeconds } from './cuTestModel'

const FRESH_MS = 3000

// The laps seen since the page opened; a car that just crossed the line is highlighted
export default function TestLeaderboardPanel({ entries, infoOf, onClear }) {
  const { t } = useTranslation('test')
  const now = useNow()
  return (
    <div
      data-testid="cu-test-leaderboard"
      className="bg-white dark:bg-gray-800 rounded-lg shadow flex flex-col overflow-hidden"
    >
      <div className="flex items-center justify-between p-3 border-b dark:border-gray-700">
        <span className="font-semibold text-gray-800 dark:text-white">{t('leaderboard.title')}</span>
        <button
          onClick={onClear}
          className="p-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-500 dark:text-gray-400"
          title={t('leaderboard.clearTitle')}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <div className="text-gray-400 text-center py-8 text-sm">{t('leaderboard.noData')}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
              <tr className="text-left text-gray-500 dark:text-gray-400 text-xs">
                <th className="px-3 py-2">{t('leaderboard.colPos')}</th>
                <th className="px-3 py-2">{t('leaderboard.colCar')}</th>
                <th className="px-3 py-2 text-right">{t('leaderboard.colLaps')}</th>
                <th className="px-3 py-2 text-right">{t('leaderboard.colBest')}</th>
                <th className="px-3 py-2 text-right">{t('leaderboard.colLast')}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => {
                const info = infoOf(entry.controller)
                return (
                  <tr
                    key={entry.controller}
                    className={`border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                      now - entry.lastUpdate < FRESH_MS ? 'bg-yellow-50 dark:bg-yellow-900/30' : ''
                    }`}
                  >
                    <td className="px-3 py-2 font-bold text-gray-900 dark:text-white">{index + 1}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full border border-gray-300 dark:border-gray-500 flex-shrink-0"
                          style={{ backgroundColor: info.color }}
                        />
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{info.driverName}</div>
                          <div className="text-xs text-gray-400">{info.carName}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-900 dark:text-white">{entry.laps}</td>
                    <td className="px-3 py-2 text-right font-mono text-green-600 dark:text-green-400">
                      {formatSeconds(entry.bestLap)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-600 dark:text-gray-300">
                      {formatSeconds(entry.lastLap)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {entries.length > 0 && (
        <div className="p-3 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-700 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex justify-between">
            <span>{t('leaderboard.totalLaps', { count: entries.reduce((s, e) => s + e.laps, 0) })}</span>
            <span>{t('leaderboard.cars', { count: entries.length })}</span>
          </div>
        </div>
      )}
    </div>
  )
}
