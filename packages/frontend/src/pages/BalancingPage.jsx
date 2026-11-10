import { useTranslation } from 'react-i18next'
import { SessionType } from '@racehubos/shared'
import SessionSection from '@/components/championship/SessionSection'
import BalancingChart from '@/components/balancing/BalancingChart'
import BalancingStandings from '@/components/balancing/BalancingStandings'
import BalancingToolbar from '@/components/balancing/BalancingToolbar'
import ReferenceDriverWarning from '@/components/balancing/ReferenceDriverWarning'
import { useApp } from '@/context/AppContext'
import { useDevice } from '@/context/DeviceContext'
import { useSession } from '@/context/SessionContext'
import { useFreeSession } from '@/hooks/useFreeSession'
import { useFreeSessionReferences } from '@/hooks/useFreeSessionReferences'
import { useStoredNumber } from '@/hooks/useStoredNumber'
import { useTrackStandings } from '@/hooks/useTrackStandings'

export default function BalancingPage() {
  const { t } = useTranslation('balancing')
  const { startRace: triggerCuStart } = useDevice()
  const { session, entries, maxLapsCompleted } = useSession()
  const { showStandings, toggleStandings, balancingTrack, setBalancingTrack } = useApp()
  const { tracks, drivers, cars } = useFreeSessionReferences(balancingTrack, setBalancingTrack)
  const { standings, reload: reloadStandings } = useTrackStandings(balancingTrack)
  const free = useFreeSession({ trackId: balancingTrack, type: SessionType.BALANCING, reloadStandings })
  const [maxLapTime, setMaxLapTime] = useStoredNumber('racehubos-balancing-maxlaptime')

  return (
    <div className="h-full flex flex-col">
      <BalancingToolbar
        tracks={tracks}
        trackId={balancingTrack}
        onTrackChange={setBalancingTrack}
        onNewSession={free.newSession}
        newSessionDisabled={!balancingTrack || free.running || free.loading}
        showStandings={showStandings}
        onToggleStandings={toggleStandings}
      />

      <div className="@container flex-1 overflow-auto p-4">
        <ReferenceDriverWarning />
        <div className={`grid grid-cols-1 ${showStandings ? '@4xl:grid-cols-3' : ''} gap-4`}>
          <div className={`${showStandings ? '@4xl:col-span-2' : ''} space-y-4`}>
            {free.loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full size-10 border-b-2 border-primary" />
              </div>
            ) : (
              <>
                <SessionSection
                  session={session}
                  sessions={[]}
                  drivers={drivers}
                  cars={cars}
                  onStart={free.start}
                  onPause={free.pause}
                  onResume={free.resume}
                  onStop={free.stop}
                  onTriggerCuStart={triggerCuStart}
                  onSaveConfig={free.saveConfig}
                  onReset={free.reset}
                  maxLapTime={maxLapTime}
                  onMaxLapTimeChange={setMaxLapTime}
                />
                {session && maxLapsCompleted > 0 && <BalancingChart entries={entries} maxLapTime={maxLapTime} />}
              </>
            )}
          </div>

          {showStandings && (
            <div>
              <h2 className="text-sm font-semibold mb-3">{t('page.standingsTitle')}</h2>
              <BalancingStandings standings={standings[SessionType.BALANCING]} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
