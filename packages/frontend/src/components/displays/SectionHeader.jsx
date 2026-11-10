import { useTranslation } from 'react-i18next'
import { COMPONENT_USAGE } from './componentUsage'

/** The pages using a component, or "unused". */
function UsageBadge({ componentName }) {
  const { t } = useTranslation('displays')
  const usage = COMPONENT_USAGE[componentName] || []
  if (usage.length === 0) {
    return (
      <span className="text-xs bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded-full">
        {t('usage.unused')}
      </span>
    )
  }
  return (
    <div className="flex flex-wrap gap-1">
      {usage.map((page) => (
        <span
          key={page}
          className="text-xs bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full"
        >
          {page}
        </span>
      ))}
    </div>
  )
}

/** Title, description, usage and code sample above each component shown. */
export default function SectionHeader({ title, description, componentName, code }) {
  return (
    <div className="flex flex-wrap gap-3 items-start justify-between mb-4">
      <div className="min-w-0 break-words">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>
        <p className="text-gray-600 dark:text-gray-400 text-sm">{description}</p>
        <div className="mt-2">
          <UsageBadge componentName={componentName} />
        </div>
      </div>
      <code className="max-w-full break-words text-sm bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-3 py-1 rounded">
        {code}
      </code>
    </div>
  )
}
