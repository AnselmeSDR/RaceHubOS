import { useTranslation } from 'react-i18next'
import { FuelMode, STANDARD_SESSION_TYPES, sessionTypeFullKey } from '@racehubos/shared'

const LABEL = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'
const INPUT =
  'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500'

const toNumber = (value) => (value ? parseInt(value) : null)

/** The session's name, type, track, championship, fuel, duration and lap limit. */
export default function SessionGeneralFields({ formData, setField, tracks, championships }) {
  const { t } = useTranslation('sessions')

  return (
    <div className="space-y-4" data-testid="session-general-fields">
      <h3 className="font-semibold text-gray-900 dark:text-white">{t('form.generalInfo')}</h3>

      <div>
        <label className={LABEL}>{t('form.name')}</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setField('name', e.target.value)}
          className={`${INPUT} focus:border-transparent`}
          placeholder={t('form.namePlaceholder')}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>{t('form.type')}</label>
          <select value={formData.type} onChange={(e) => setField('type', e.target.value)} className={INPUT}>
            {STANDARD_SESSION_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(sessionTypeFullKey(type))}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL}>{t('glossary:track', { count: 1 })}</label>
          <select
            required
            value={formData.trackId}
            onChange={(e) => setField('trackId', e.target.value)}
            className={INPUT}
          >
            <option value="">{t('form.selectTrack')}</option>
            {tracks.map((track) => (
              <option key={track.id} value={track.id}>
                {track.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>{t('form.championshipOptional')}</label>
          <select
            value={formData.championshipId}
            onChange={(e) => setField('championshipId', e.target.value)}
            className={INPUT}
          >
            <option value="">{t('form.none')}</option>
            {championships.map((champ) => (
              <option key={champ.id} value={champ.id}>
                {champ.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={LABEL}>{t('form.fuel')}</label>
          <select value={formData.fuelMode} onChange={(e) => setField('fuelMode', e.target.value)} className={INPUT}>
            <option value={FuelMode.OFF}>{t('form.fuelOff')}</option>
            <option value={FuelMode.ON}>{t('form.fuelOn')}</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>{t('form.duration')}</label>
          <input
            type="number"
            value={formData.duration || ''}
            onChange={(e) => setField('duration', toNumber(e.target.value))}
            className={INPUT}
            placeholder={t('form.durationPlaceholder')}
          />
        </div>

        <div>
          <label className={LABEL}>{t('form.maxLaps')}</label>
          <input
            type="number"
            value={formData.maxLaps || ''}
            onChange={(e) => setField('maxLaps', toNumber(e.target.value))}
            className={INPUT}
            placeholder={t('form.maxLapsPlaceholder')}
          />
        </div>
      </div>
    </div>
  )
}
