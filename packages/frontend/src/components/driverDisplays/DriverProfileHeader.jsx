import { BarChart3, Flag, Trophy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getImgUrl } from '@/utils/image'
import StatBox from './StatBox'
import { DivisionBadges } from '@/components/division/DivisionBadge'

/**
 * DriverProfileHeader - En-tête de profil détaillé
 * Style F1 avec toutes les stats
 */
export default function DriverProfileHeader({ driver }) {
  const { t } = useTranslation('displays')
  return (
    <div
      data-testid="driver-profile-display"
      className="relative overflow-hidden rounded-2xl shadow-2xl"
      style={{
        background: `linear-gradient(135deg, ${driver.color}20 0%, ${driver.color}05 100%)`,
      }}
    >
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            ${driver.color},
            ${driver.color} 10px,
            transparent 10px,
            transparent 20px
          )`,
        }}
      />

      <div className="relative p-8">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          {/* Large avatar */}
          <div className="relative flex-shrink-0">
            <div
              className="absolute inset-0 rounded-2xl blur-xl opacity-50"
              style={{ backgroundColor: driver.color }}
            />
            <div
              className="relative w-32 h-32 rounded-2xl flex items-center justify-center text-white font-black text-5xl ring-4 ring-white shadow-2xl overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${driver.color} 0%, ${driver.color}CC 100%)`,
              }}
            >
              {driver.img ? (
                <img src={getImgUrl(driver.img)} alt={driver.name} className="w-full h-full object-cover" />
              ) : (
                <span className="drop-shadow-lg">{driver.name.charAt(0)}</span>
              )}
            </div>

            {/* Number badge overlay (supports 3 digits) */}
            {driver.number && (
              <div
                className="absolute -bottom-3 -right-3 w-18 h-16 rounded-xl flex items-center justify-center shadow-xl ring-4 ring-white px-2"
                style={{ backgroundColor: driver.color }}
              >
                <span
                  className={`font-black text-white italic ${String(driver.number).length >= 3 ? 'text-2xl' : 'text-3xl'}`}
                >
                  {driver.number}
                </span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 w-full">
            <DivisionBadges divisions={driver.divisions} large className="flex flex-wrap gap-1.5 mb-3" />

            {/* Name */}
            <h1
              className="font-black text-3xl sm:text-5xl break-words tracking-tight mb-2"
              style={{
                color: driver.color,
                textShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}
            >
              {driver.name.toUpperCase()}
            </h1>

            {/* Stats row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
              <StatBox
                icon={<Flag className="w-5 h-5" />}
                label={t('glossary:race_other')}
                value={driver._count?.sessions || 0}
                color={driver.color}
              />
              <StatBox
                icon={<Trophy className="w-5 h-5" />}
                label={t('glossary:win_other')}
                value={driver.wins || 0}
                color="#EAB308"
                highlight
              />
              <StatBox
                icon={<Trophy className="w-5 h-5" />}
                label={t('glossary:podium_other')}
                value={driver.podiums || 0}
                color={driver.color}
              />
              <StatBox
                icon={<BarChart3 className="w-5 h-5" />}
                label={t('glossary:lap_other')}
                value={driver._count?.laps || 0}
                color={driver.color}
              />
            </div>

            {/* Best lap */}
            {driver.bestLap && (
              <div className="mt-4 inline-block">
                <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg px-6 py-3 shadow-md">
                  <div className="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">
                    {t('driverDisplays.bestLap')}
                  </div>
                  <div className="text-3xl font-black tabular-nums" style={{ color: driver.color }}>
                    {(driver.bestLap / 1000).toFixed(3)}s
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Racing stripe */}
      <div className="absolute top-0 left-0 w-2 h-full" style={{ backgroundColor: driver.color }} />
    </div>
  )
}
