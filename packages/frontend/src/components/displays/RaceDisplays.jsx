import { useTranslation } from 'react-i18next'
import Leaderboard from '@/components/race/Leaderboard'
import LapTime from '@/components/race/LapTime'
import StateChip from '@/components/race/StateChip'
import GapDisplay from '@/components/race/GapDisplay'
import FreePracticeLeaderboard from '@/components/race/freePractice/FreePracticeLeaderboard'
import SectionHeader from './SectionHeader'
import LoadingState from './LoadingState'

export default function RaceDisplays({ drivers, cars, loading }) {
  const { t } = useTranslation('displays')

  if (loading) return <LoadingState />

  // Demo data
  const demoLeaderboard = drivers.slice(0, 4).map((driver, idx) => ({
    controller: String(idx + 1),
    driver,
    car: cars[idx] || null,
    laps: 10 - idx,
    bestLap: 5200 + idx * 150,
    lastLap: 5300 + idx * 100,
    gap: idx === 0 ? null : `+${idx * 2}.${idx}s`,
    position: idx + 1,
  }))

  const demoFreePracticeBoard = {
    '1': { laps: 5, bestLap: 5234, lastLap: 5300 },
    '2': { laps: 4, bestLap: 5456, lastLap: 5500 },
    '3': { laps: 3, bestLap: 5678, lastLap: 5700 },
  }

  const demoConfigs = drivers.slice(0, 3).map((driver, idx) => ({
    controller: String(idx + 1),
    driver,
    car: cars[idx] || null,
    driverId: driver.id,
    carId: cars[idx]?.id,
  }))

  return (
    <>
      {/* LapTime */}
      <section>
        <SectionHeader
          title={t('race.lapTime.title')}
          description={t('race.lapTime.description')}
          componentName="LapTime"
          code="<LapTime time={5234} />"
        />
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow flex flex-wrap gap-6 items-center">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">size="sm"</p>
            <LapTime time={5234} size="sm" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('race.lapTimeDefault')}</p>
            <LapTime time={5234} size="md" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">size="lg"</p>
            <LapTime time={5234} size="lg" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('race.lapTimeIsBest')}</p>
            <LapTime time={5234} isBest={true} />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('race.lapTimeNull')}</p>
            <LapTime time={null} />
          </div>
        </div>
      </section>

      {/* StateChip */}
      <section>
        <SectionHeader
          title={t('race.stateChip.title')}
          description={t('race.stateChip.description')}
          componentName="StateChip"
          code="<StateChip state='racing' />"
        />
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow flex flex-wrap gap-4">
          <StateChip state="idle" />
          <StateChip state="ready" />
          <StateChip state="racing" />
          <StateChip state="paused" />
          <StateChip state="finished" />
        </div>
      </section>

      {/* GapDisplay */}
      <section>
        <SectionHeader
          title={t('race.gapDisplay.title')}
          description={t('race.gapDisplay.description')}
          componentName="GapDisplay"
          code="<GapDisplay gap='+2.5s' />"
        />
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow flex flex-wrap gap-4 items-center">
          <GapDisplay gap={null} />
          <GapDisplay gap="+0.5s" />
          <GapDisplay gap="+2.345s" />
          <GapDisplay gap="+1 LAP" />
        </div>
      </section>

      {/* Leaderboard */}
      <section>
        <SectionHeader
          title={t('race.leaderboard.title')}
          description={t('race.leaderboard.description')}
          componentName="Leaderboard"
          code="<Leaderboard leaderboard={[...]} />"
        />
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <Leaderboard leaderboard={demoLeaderboard} sessionType="race" />
        </div>
      </section>

      {/* FreePracticeLeaderboard */}
      <section>
        <SectionHeader
          title={t('race.freePracticeLeaderboard.title')}
          description={t('race.freePracticeLeaderboard.description')}
          componentName="FreePracticeLeaderboard"
          code="<FreePracticeLeaderboard />"
        />
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
          <FreePracticeLeaderboard freePracticeBoard={demoFreePracticeBoard} configs={demoConfigs} onReset={() => {}} />
        </div>
      </section>
    </>
  )
}
