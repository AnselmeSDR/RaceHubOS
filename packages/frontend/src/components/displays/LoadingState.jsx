import { useTranslation } from 'react-i18next'

/** Shown while the sample drivers, cars and tracks load. */
export default function LoadingState() {
  const { t } = useTranslation('displays')
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">{t('loading')}</p>
      </div>
    </div>
  )
}
