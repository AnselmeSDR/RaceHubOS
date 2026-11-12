import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChampionshipMode } from '@racehubos/shared'
import ChampionshipBracketPanel from '../components/championship/ChampionshipBracketPanel'
import ChampionshipConfigModal from '../components/championship/ChampionshipConfigModal'
import ChampionshipHeader from '../components/championship/ChampionshipHeader'
import ChampionshipResults from '../components/championship/ChampionshipResults'
import ChampionshipStandingsPanel from '../components/championship/ChampionshipStandingsPanel'
import SessionSection from '../components/championship/SessionSection'
import SessionBoard from '../components/race/SessionBoard'
import { useStandingsTab } from '../components/championship/useStandingsTab'
import { useApp } from '../context/AppContext'
import { useDevice } from '../context/DeviceContext'
import { useChampionshipDetail } from '../hooks/useChampionshipDetail'
import { useDisplayedEntries } from '../hooks/useDisplayedEntries'
import { useSessionActions } from '../hooks/useSessionActions'
import { deleteChampionship } from '../lib/championshipApi'

export default function ChampionshipDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { startRace: triggerCuStart } = useDevice()
  const { showStandings, toggleStandings } = useApp()
  const detail = useChampionshipDetail(id)
  const { championship, sessions, drivers, selectedSession } = detail
  const actions = useSessionActions(detail)
  const { entries, maxLaps } = useDisplayedEntries(selectedSession)
  const [standingsTab, setStandingsTab] = useStandingsTab(selectedSession?.type)

  const [showChampionshipConfig, setShowChampionshipConfig] = useState(false)
  const [showBracket, setShowBracket] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [practiceSortBy, setPracticeSortBy] = useState('laps')

  if (detail.loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full size-10 border-b-2 border-yellow-500" />
      </div>
    )
  }

  const autoMode = championship?.mode === ChampionshipMode.AUTO

  async function handleDeleteChampionship() {
    try {
      await deleteChampionship(id)
    } finally {
      navigate('/championships')
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header bar with session tabs */}
      <ChampionshipHeader
        onDelete={handleDeleteChampionship}
        championship={championship}
        sessions={sessions}
        selectedSession={selectedSession}
        onSelectSession={(s) => {
          detail.selectSession(s.id)
          setShowResults(false)
        }}
        onConfig={() => setShowChampionshipConfig(true)}
        showConfig={showChampionshipConfig}
        onFinish={detail.finish}
        showStandings={showStandings}
        onToggleStandings={toggleStandings}
        showBracket={showBracket}
        onToggleBracket={() => setShowBracket((v) => !v)}
        showResults={showResults}
        onSelectResults={() => {
          setShowResults(true)
          setShowBracket(false)
        }}
      />

      {/* Main content */}
      <div className="@container flex-1 overflow-auto p-4">
        {showBracket && autoMode && (
          <ChampionshipBracketPanel
            championshipId={id}
            onSessionSelect={(sessionId) => {
              detail.selectSession(sessionId)
              setShowBracket(false)
            }}
          />
        )}

        {showResults ? (
          <ChampionshipResults championshipId={id} />
        ) : (
          <div className={`grid grid-cols-1 ${showStandings ? '@4xl:grid-cols-3' : ''} gap-4`}>
            {/* Left: Session + Leaderboard */}
            <div className={`${showStandings ? '@4xl:col-span-2' : ''} space-y-4`}>
              <SessionSection
                session={selectedSession}
                sessions={sessions}
                drivers={detail.sessionDrivers}
                cars={detail.cars}
                autoMode={autoMode}
                onStart={actions.start}
                onPause={actions.pause}
                onResume={actions.resume}
                onStop={actions.stop}
                onTriggerCuStart={triggerCuStart}
                onSaveConfig={actions.saveConfig}
                onReset={actions.reset}
              />
              <SessionBoard
                session={selectedSession}
                entries={entries}
                maxLaps={maxLaps}
                expanded={!showStandings}
                practiceSortBy={practiceSortBy}
                onPracticeSortChange={setPracticeSortBy}
              />
            </div>

            {showStandings && (
              <ChampionshipStandingsPanel
                standings={detail.standings}
                drivers={drivers}
                activeTab={standingsTab}
                onTabChange={setStandingsTab}
              />
            )}
          </div>
        )}
      </div>

      {showChampionshipConfig && (
        <ChampionshipConfigModal
          championship={championship}
          sessions={sessions}
          tracks={detail.tracks}
          drivers={drivers}
          cars={detail.cars}
          open={showChampionshipConfig}
          onClose={() => setShowChampionshipConfig(false)}
          onSave={(updated) => detail.setChampionship(updated)}
          onFinish={detail.finish}
          onSessionsChange={() => {
            detail.reloadChampionship()
            detail.reloadSessions()
            detail.reloadStandings()
          }}
        />
      )}
    </div>
  )
}
