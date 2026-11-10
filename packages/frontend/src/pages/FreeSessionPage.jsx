import { useState } from 'react'
import FreeSessionStandingsPanel from '../components/freeSession/FreeSessionStandingsPanel'
import FreeSessionToolbar from '../components/freeSession/FreeSessionToolbar'
import SessionSection from '../components/championship/SessionSection'
import SessionBoard from '../components/race/SessionBoard'
import { useApp } from '../context/AppContext'
import { useDevice } from '../context/DeviceContext'
import { useSession } from '../context/SessionContext'
import { useFreeSession } from '../hooks/useFreeSession'
import { useFreeSessionReferences } from '../hooks/useFreeSessionReferences'
import { useTrackStandings } from '../hooks/useTrackStandings'

export default function FreeSessionPage() {
  const { startRace: triggerCuStart } = useDevice()
  const { session, entries, maxLapsCompleted } = useSession()
  const { showStandings, toggleStandings, freeTrack, setFreeTrack, freeType, setFreeType } = useApp()
  const { tracks, drivers, cars } = useFreeSessionReferences(freeTrack, setFreeTrack)
  const { standings, reload: reloadStandings } = useTrackStandings(freeTrack)
  const free = useFreeSession({ trackId: freeTrack, type: freeType, reloadStandings })
  const [practiceSortBy, setPracticeSortBy] = useState('laps')

  return (
    <div className="h-full flex flex-col">
      <FreeSessionToolbar
        tracks={tracks}
        trackId={freeTrack}
        onTrackChange={setFreeTrack}
        type={freeType}
        onTypeChange={setFreeType}
        onNewSession={free.newSession}
        newSessionDisabled={!freeTrack || free.running || free.loading}
        showStandings={showStandings}
        onToggleStandings={toggleStandings}
      />

      {/* Main content */}
      <div className="@container flex-1 overflow-auto p-4">
        <div className={`grid grid-cols-1 ${showStandings ? '@4xl:grid-cols-3' : ''} gap-4`}>
          {/* Left: Session + Leaderboard */}
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
                />
                <SessionBoard
                  session={session}
                  entries={entries}
                  maxLaps={maxLapsCompleted}
                  expanded={!showStandings}
                  practiceSortBy={practiceSortBy}
                  onPracticeSortChange={setPracticeSortBy}
                />
              </>
            )}
          </div>

          {showStandings && (
            <FreeSessionStandingsPanel
              standings={standings}
              drivers={drivers}
              activeTab={freeType}
              onTabChange={setFreeType}
            />
          )}
        </div>
      </div>
    </div>
  )
}
