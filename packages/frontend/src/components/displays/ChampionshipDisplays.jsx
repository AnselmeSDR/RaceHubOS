import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Flag, Clock, RefreshCw, Trophy, FlaskConical } from 'lucide-react'
import Leaderboard from '@/components/race/Leaderboard'
import LapTime from '@/components/race/LapTime'
import FreePracticeLeaderboard from '@/components/race/freePractice/FreePracticeLeaderboard'
import { SessionStatus, SessionType, sessionTypeFullKey } from '@racehubos/shared'
import SectionHeader from './SectionHeader'
import LoadingState from './LoadingState'

export default function ChampionshipDisplays({ drivers, cars, loading }) {
  const { t } = useTranslation('displays')
  const [sessionType, setSessionType] = useState(SessionType.PRACTICE)

  if (loading) return <LoadingState />

  // Generate demo data based on session type
  const generateLeaderboard = (type) => {
    const baseData = drivers.slice(0, 4).map((driver, idx) => ({
      controller: String(idx + 1),
      driver,
      car: cars[idx] || null,
      position: idx + 1,
    }))

    switch (type) {
      case SessionType.PRACTICE:
        return baseData.map((entry, idx) => ({
          ...entry,
          laps: 12 - idx * 2,
          bestLap: 5100 + idx * 80,
          lastLap: 5200 + idx * 100,
          gap: idx === 0 ? null : `+${(idx * 0.8).toFixed(1)}s`,
        }))
      case SessionType.QUALIF:
        return baseData.map((entry, idx) => ({
          ...entry,
          laps: 5,
          bestLap: 5050 + idx * 120,
          lastLap: 5100 + idx * 150,
          gap: idx === 0 ? null : `+${(idx * 0.12).toFixed(3)}s`,
        }))
      case SessionType.RACE:
        return baseData.map((entry, idx) => ({
          ...entry,
          laps: 25 - idx,
          bestLap: 5200 + idx * 50,
          lastLap: 5300 + idx * 80,
          gap: idx === 0 ? null : idx === 1 ? '+2.5s' : `+${idx} LAP`,
        }))
      default:
        return baseData
    }
  }

  const demoLeaderboard = generateLeaderboard(sessionType)

  const demoFreePracticeBoard = {
    '1': { laps: 8, bestLap: 5134, lastLap: 5200 },
    '2': { laps: 6, bestLap: 5256, lastLap: 5300 },
    '3': { laps: 5, bestLap: 5378, lastLap: 5450 },
  }

  const demoConfigs = drivers.slice(0, 3).map((driver, idx) => ({
    controller: String(idx + 1),
    driver,
    car: cars[idx] || null,
    driverId: driver.id,
    carId: cars[idx]?.id,
  }))

  const sessionTypeLabels = {
    [SessionType.PRACTICE]: {
      label: t(sessionTypeFullKey(SessionType.PRACTICE)),
      icon: FlaskConical,
      color: 'bg-gray-500',
    },
    [SessionType.QUALIF]: { label: t(sessionTypeFullKey(SessionType.QUALIF)), icon: Clock, color: 'bg-purple-500' },
    [SessionType.RACE]: { label: t(sessionTypeFullKey(SessionType.RACE)), icon: Flag, color: 'bg-green-500' },
  }

  const currentSession = sessionTypeLabels[sessionType]
  const SessionIcon = currentSession.icon

  return (
    <>
      {/* Session Type Selector */}
      <section>
        <SectionHeader
          title={t('championship.sessionTypes.title')}
          description={t('championship.sessionTypes.description')}
          componentName="SessionType"
          code="sessionType: 'practice' | 'qualif' | 'race'"
        />
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex flex-wrap gap-3 mb-4">
            {Object.entries(sessionTypeLabels).map(([type, { label, icon: Icon, color }]) => (
              <button
                key={type}
                onClick={() => setSessionType(type)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                  sessionType === type
                    ? `${color} text-white shadow-lg scale-105`
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <Icon className="w-5 h-5" />
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span>{t('championship.activeSession')}</span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 ${currentSession.color} text-white rounded-full text-xs font-medium`}
            >
              <SessionIcon className="w-3 h-3" />
              {currentSession.label}
            </span>
          </div>
        </div>
      </section>

      {/* Session Status Badges */}
      <section>
        <SectionHeader
          title={t('championship.statusBadges.title')}
          description={t('championship.statusBadges.description')}
          componentName="SessionStatus"
          code="status: SessionStatus.DRAFT | 'active' | 'finishing' | 'finished'"
        />
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow flex flex-wrap gap-3">
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
            {t('championship.statusDraft')}
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300">
            {t('championship.statusActive')}
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 animate-pulse">
            {t('championship.statusFinishing')}
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
            {t('championship.statusFinished')}
          </span>
        </div>
      </section>

      {/* Leaderboard by Session Type */}
      <section>
        <SectionHeader
          title={t('championship.leaderboardByType.title', { type: currentSession.label })}
          description={
            sessionType === SessionType.PRACTICE
              ? t('championship.leaderboardByType.descriptionPractice')
              : sessionType === SessionType.QUALIF
                ? t('championship.leaderboardByType.descriptionQualif')
                : t('championship.leaderboardByType.descriptionRace')
          }
          componentName="Leaderboard"
          code={`<Leaderboard sessionType="${sessionType}" />`}
        />
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden p-4">
          <div className="flex items-center gap-2 mb-4">
            <SessionIcon
              className={`w-5 h-5 ${
                sessionType === SessionType.PRACTICE
                  ? 'text-gray-500'
                  : sessionType === SessionType.QUALIF
                    ? 'text-purple-500'
                    : 'text-green-500'
              }`}
            />
            <span className="font-semibold text-gray-700 dark:text-gray-200">{currentSession.label}</span>
            {sessionType === SessionType.QUALIF && (
              <span className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
                <Clock className="w-3 h-3" />
                {t('championship.maxLaps', { count: 5 })}
              </span>
            )}
            {sessionType === SessionType.RACE && (
              <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                <RefreshCw className="w-3 h-3" />
                {t('championship.raceLaps', { count: 25 })}
              </span>
            )}
          </div>
          <Leaderboard leaderboard={demoLeaderboard} />
        </div>
      </section>

      {/* FreePracticeLeaderboard with sort options */}
      <section>
        <SectionHeader
          title={t('championship.freePracticeLeaderboard.title')}
          description={t('championship.freePracticeLeaderboard.description')}
          componentName="FreePracticeLeaderboard"
          code="<FreePracticeLeaderboard />"
        />
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
          <FreePracticeLeaderboard freePracticeBoard={demoFreePracticeBoard} configs={demoConfigs} onReset={() => {}} />
        </div>
      </section>

      {/* Standings Panel Example */}
      <section>
        <SectionHeader
          title={t('championship.standingsPanel.title')}
          description={t('championship.standingsPanel.description')}
          componentName="StandingsPanel"
          code="<StandingsPanel />"
        />
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b dark:border-gray-700">
            <h3 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              {t('championship.standingsPanel.heading')}
            </h3>
          </div>
          <div className="flex border-b dark:border-gray-700">
            <button className="flex-1 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 border-b-2 border-transparent">
              <FlaskConical className="w-4 h-4 inline mr-1" />
              {t('championship.tabFree')}
            </button>
            <button className="flex-1 py-2 text-sm font-medium text-purple-600 dark:text-purple-400 border-b-2 border-purple-500">
              <Clock className="w-4 h-4 inline mr-1" />
              {t('championship.tabQualif')}
            </button>
            <button className="flex-1 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 border-b-2 border-transparent">
              <Flag className="w-4 h-4 inline mr-1" />
              {t('championship.tabRace')}
            </button>
          </div>
          <div className="p-4 space-y-2">
            {drivers.slice(0, 4).map((driver, idx) => (
              <div
                key={driver.id}
                className={`flex items-center gap-3 p-2 rounded-lg ${
                  idx === 0
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700'
                    : idx === 1
                      ? 'bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600'
                      : idx === 2
                        ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700'
                        : 'bg-gray-50 dark:bg-gray-700/50'
                }`}
              >
                <span
                  className={`w-6 text-center font-bold ${
                    idx === 0
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : idx === 1
                        ? 'text-gray-500 dark:text-gray-400'
                        : idx === 2
                          ? 'text-orange-600 dark:text-orange-400'
                          : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {idx + 1}
                </span>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                  style={{ backgroundColor: driver.color || '#6B7280' }}
                >
                  {driver.img ? (
                    <img src={driver.img} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    driver.name?.charAt(0) || '?'
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-white text-sm">{driver.name}</div>
                </div>
                <LapTime time={5050 + idx * 120} size="sm" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
