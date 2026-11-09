import { useTranslation } from 'react-i18next'
import { logColor, sourceBadge } from './cuTestModel'

export default function TestLogLine({ log }) {
  const { t, i18n } = useTranslation('test')
  return (
    <div data-testid="cu-test-log" className={`flex items-start gap-2 ${logColor(log.type)}`}>
      <span className="text-gray-500 flex-shrink-0">{new Date(log.timestamp).toLocaleTimeString(i18n.language)}</span>
      <span className={`px-1.5 py-0.5 rounded text-[10px] text-white flex-shrink-0 ${sourceBadge(log.source)}`}>
        {log.source}
      </span>
      <span className="flex-1">{log.message}</span>
      {log.data && (
        <button
          onClick={() => console.log(log.data)}
          className="text-gray-500 hover:text-gray-300 flex-shrink-0"
          title={t('logs.logDataTitle')}
        >
          {t('logs.logData')}
        </button>
      )}
    </div>
  )
}
