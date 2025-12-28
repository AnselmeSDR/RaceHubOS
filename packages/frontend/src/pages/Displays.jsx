import { useState, useEffect } from 'react'
import {
  UserGroupIcon,
  FlagIcon,
  Cog6ToothIcon,
  RectangleStackIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  ArrowPathIcon,
  TrophyIcon,
  BeakerIcon,
} from '@heroicons/react/24/outline'

// Driver components
import {
  DriverListItem,
  DriverBadge,
  DriverGridPosition,
  DriverProfileHeader,
  DriverStanding,
  DriverSelectCard
} from '../components/DriverDisplays'

// Race components
import Leaderboard from '../components/race/Leaderboard'
import LapTime from '../components/race/LapTime'
import StateChip from '../components/race/StateChip'
import GapDisplay from '../components/race/GapDisplay'
import FreePracticeLeaderboard from '../components/race/freePractice/FreePracticeLeaderboard'
import ControllerConfigSection from '../components/race/freePractice/ControllerConfigSection'

// CRUD components
import PageHeader, { ViewToggleButtons } from '../components/crud/PageHeader'
import EmptyState from '../components/crud/EmptyState'
import EntityCard, { StatBadge } from '../components/crud/EntityCard'
import ColorPickerField from '../components/crud/ColorPickerField'
import { FormField, TextField } from '../components/crud/FormModal'
import RangeField from '../components/crud/RangeField'

// Config components
import ConfigStatus from '../components/config/ConfigStatus'

// UI components
import Modal, { ModalFooter, ModalButton } from '../components/ui/Modal'
import ErrorMessage from '../components/ErrorMessage'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

// Component usage mapping
const COMPONENT_USAGE = {
  // Driver displays
  DriverListItem: ['Drivers.jsx'],
  DriverBadge: [],
  DriverGridPosition: [],
  DriverProfileHeader: ['DriverProfile.jsx'],
  DriverStanding: [],
  DriverSelectCard: [],

  // Race components
  Leaderboard: ['RaceControl.jsx', 'RacePage.jsx', 'ChampionshipDetail.jsx'],
  LapTime: ['RaceControl.jsx', 'FreePractice.jsx', 'ChampionshipDetail.jsx', 'StandingsTabs.jsx', 'ResultsModal.jsx', 'TrackRecordsPanel.jsx', 'FreePracticeEntry.jsx'],
  StateChip: ['RaceControl.jsx', 'FreePractice.jsx', 'SessionHeader.jsx', 'FreePracticeHeader.jsx'],
  GapDisplay: ['Leaderboard.jsx'],
  FreePracticeLeaderboard: ['RacePage.jsx', 'ChampionshipDetail.jsx'],
  FreePracticeEntry: ['FreePracticeLeaderboard.jsx'],
  ControllerConfigSection: ['RacePage.jsx', 'ChampionshipDetail.jsx'],
  TrackRecordsPanel: ['RacePage.jsx'],

  // CRUD components
  PageHeader: ['Drivers.jsx', 'Tracks.jsx', 'Teams.jsx', 'Cars.jsx', 'Championships.jsx'],
  ViewToggleButtons: ['Drivers.jsx', 'Tracks.jsx', 'Teams.jsx', 'Cars.jsx', 'Championships.jsx'],
  EmptyState: ['Drivers.jsx', 'Tracks.jsx', 'Teams.jsx', 'Cars.jsx', 'Championships.jsx'],
  EntityCard: [],
  StatBadge: [],
  PhotoUploadField: ['Drivers.jsx', 'Tracks.jsx', 'Teams.jsx', 'Cars.jsx'],
  ColorPickerField: ['Drivers.jsx', 'Tracks.jsx', 'Teams.jsx', 'Cars.jsx'],
  FormModal: ['Drivers.jsx', 'Tracks.jsx', 'Teams.jsx', 'Cars.jsx', 'Championships.jsx'],
  RangeField: ['Cars.jsx'],

  // Config components
  ConfigPanel: ['FreePractice.jsx'],
  ConfigStatus: ['FreePractice.jsx', 'ControllerConfigSection.jsx'],

  // UI components
  Modal: ['FormModal.jsx', 'SessionModal.jsx'],
  ErrorMessage: ['Tracks.jsx', 'Drivers.jsx', 'Teams.jsx', 'SessionDetail.jsx', 'SessionsList.jsx', 'Sessions.jsx', 'Cars.jsx', 'Stats.jsx'],
}

export default function Displays() {
  const [activeTab, setActiveTab] = useState('drivers')
  const [drivers, setDrivers] = useState([])
  const [cars, setCars] = useState([])
  const [tracks, setTracks] = useState([])
  const [selectedDrivers, setSelectedDrivers] = useState([])
  const [loading, setLoading] = useState(true)

  const tabs = [
    { id: 'drivers', label: 'Pilotes', Icon: UserGroupIcon },
    { id: 'championship', label: 'Championnat', Icon: TrophyIcon },
    { id: 'race', label: 'Course', Icon: FlagIcon },
    { id: 'crud', label: 'CRUD', Icon: RectangleStackIcon },
    { id: 'config', label: 'Config', Icon: Cog6ToothIcon },
    { id: 'unused', label: 'Non utilisés', Icon: ExclamationTriangleIcon },
  ]

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [driversRes, carsRes, tracksRes] = await Promise.all([
        fetch(`${API_URL}/drivers`),
        fetch(`${API_URL}/cars`),
        fetch(`${API_URL}/tracks`),
      ])
      const [driversData, carsData, tracksData] = await Promise.all([
        driversRes.json(),
        carsRes.json(),
        tracksRes.json(),
      ])
      setDrivers(driversData.data || [])
      setCars(carsData.data || [])
      setTracks(tracksData.data || [])
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  function toggleDriver(driverId) {
    setSelectedDrivers(prev =>
      prev.includes(driverId)
        ? prev.filter(id => id !== driverId)
        : [...prev, driverId]
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Displays - Composants d'affichage
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Collection de tous les composants d'affichage utilisés dans l'application
        </p>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-8">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const { Icon } = tab
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-12">
        {activeTab === 'drivers' && (
          <DriversDisplays
            drivers={drivers}
            selectedDrivers={selectedDrivers}
            toggleDriver={toggleDriver}
            loading={loading}
          />
        )}

        {activeTab === 'championship' && (
          <ChampionshipDisplays
            drivers={drivers}
            cars={cars}
            loading={loading}
          />
        )}

        {activeTab === 'race' && (
          <RaceDisplays
            drivers={drivers}
            cars={cars}
            loading={loading}
          />
        )}

        {activeTab === 'crud' && (
          <CRUDDisplays
            drivers={drivers}
            cars={cars}
            tracks={tracks}
            loading={loading}
          />
        )}

        {activeTab === 'config' && (
          <ConfigDisplays
            drivers={drivers}
            cars={cars}
            loading={loading}
          />
        )}

        {activeTab === 'unused' && (
          <UnusedDisplays
            drivers={drivers}
            cars={cars}
            loading={loading}
          />
        )}
      </div>
    </div>
  )
}

// Usage badge component
function UsageBadge({ componentName }) {
  const usage = COMPONENT_USAGE[componentName] || []
  if (usage.length === 0) {
    return (
      <span className="text-xs bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded-full">
        Non utilisé
      </span>
    )
  }
  return (
    <div className="flex flex-wrap gap-1">
      {usage.map(page => (
        <span key={page} className="text-xs bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
          {page}
        </span>
      ))}
    </div>
  )
}

// Section header component
function SectionHeader({ title, description, componentName, code }) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>
        <p className="text-gray-600 dark:text-gray-400 text-sm">{description}</p>
        <div className="mt-2">
          <UsageBadge componentName={componentName} />
        </div>
      </div>
      <code className="text-sm bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-3 py-1 rounded whitespace-nowrap">
        {code}
      </code>
    </div>
  )
}

// Drivers Displays Tab
function DriversDisplays({ drivers, selectedDrivers, toggleDriver, loading }) {
  if (loading) {
    return <LoadingState />
  }

  if (drivers.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
        <p className="text-gray-500 dark:text-gray-400">
          Aucun pilote trouvé. Ajoutez des pilotes pour voir les composants.
        </p>
      </div>
    )
  }

  const demoDriver = drivers[0]

  return (
    <>
      {/* DriverProfileHeader */}
      <section>
        <SectionHeader
          title="Profile Header"
          description="En-tête de profil détaillé avec toutes les statistiques"
          componentName="DriverProfileHeader"
          code="<DriverProfileHeader />"
        />
        <DriverProfileHeader driver={demoDriver} />
      </section>

      {/* DriverListItem */}
      <section>
        <SectionHeader
          title="List Item"
          description="Format liste compact pour sélections et vues compactes"
          componentName="DriverListItem"
          code="<DriverListItem />"
        />
        <div className="space-y-3 bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          {drivers.slice(0, 4).map((driver, index) => (
            <DriverListItem
              key={driver.id}
              driver={driver}
              position={index + 1}
              showStats={true}
            />
          ))}
        </div>
      </section>

      {/* DriverGridPosition */}
      <section>
        <SectionHeader
          title="Grid Position"
          description="Grille de départ style NASCAR avec ROW"
          componentName="DriverGridPosition"
          code="<DriverGridPosition />"
        />
        <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-lg space-y-4">
          {drivers.slice(0, 6).map((driver, index) => {
            const row = Math.floor(index / 2) + 1
            const side = index % 2 === 0 ? 'left' : 'right'
            return (
              <div key={driver.id} className="flex items-center gap-6">
                {side === 'left' && (
                  <>
                    <DriverGridPosition driver={driver} row={row} side="left" />
                    <div className="w-20 text-center">
                      <div className="font-black text-2xl text-gray-400">ROW</div>
                      <div className="font-black text-3xl text-gray-900 dark:text-white">{row}</div>
                    </div>
                  </>
                )}
                {side === 'right' && (
                  <>
                    <div className="w-20 text-center">
                      <div className="font-black text-2xl text-gray-400">ROW</div>
                      <div className="font-black text-3xl text-gray-900 dark:text-white">{row}</div>
                    </div>
                    <DriverGridPosition driver={driver} row={row} side="right" />
                  </>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* DriverStanding */}
      <section>
        <SectionHeader
          title="Standing"
          description="Classement avec position, points et changement"
          componentName="DriverStanding"
          code="<DriverStanding />"
        />
        <div className="space-y-3">
          {drivers.slice(0, 5).map((driver, index) => (
            <DriverStanding
              key={driver.id}
              driver={driver}
              position={index + 1}
              points={25 - index * 3}
              change={index === 0 ? 2 : index === 1 ? -1 : 0}
            />
          ))}
        </div>
      </section>

      {/* DriverSelectCard */}
      <section>
        <SectionHeader
          title="Select Card"
          description="Sélection multi-pilotes pour configuration de session"
          componentName="DriverSelectCard"
          code="<DriverSelectCard />"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {drivers.map((driver) => (
            <DriverSelectCard
              key={driver.id}
              driver={driver}
              selected={selectedDrivers.includes(driver.id)}
              onToggle={() => toggleDriver(driver.id)}
            />
          ))}
        </div>
      </section>

      {/* DriverBadge */}
      <section>
        <SectionHeader
          title="Badge"
          description="Badges compacts pour menus, notifications, etc."
          componentName="DriverBadge"
          code="<DriverBadge />"
        />
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Small</p>
            <div className="flex flex-wrap gap-3">
              {drivers.slice(0, 6).map((driver) => (
                <DriverBadge key={driver.id} driver={driver} size="sm" showName={false} />
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Medium (avec nom)</p>
            <div className="flex flex-wrap gap-3">
              {drivers.slice(0, 4).map((driver) => (
                <DriverBadge key={driver.id} driver={driver} size="md" showName={true} />
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Large</p>
            <div className="flex flex-wrap gap-3">
              {drivers.slice(0, 3).map((driver) => (
                <DriverBadge key={driver.id} driver={driver} size="lg" showName={false} />
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

// Race Displays Tab
function RaceDisplays({ drivers, cars, loading }) {
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
          title="LapTime"
          description="Affichage formaté des temps au tour (mm:ss.ms)"
          componentName="LapTime"
          code="<LapTime time={5234} />"
        />
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow flex flex-wrap gap-6 items-center">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">size="sm"</p>
            <LapTime time={5234} size="sm" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">size="md" (default)</p>
            <LapTime time={5234} size="md" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">size="lg"</p>
            <LapTime time={5234} size="lg" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">isBest=true</p>
            <LapTime time={5234} isBest={true} />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">null/invalid</p>
            <LapTime time={null} />
          </div>
        </div>
      </section>

      {/* StateChip */}
      <section>
        <SectionHeader
          title="StateChip"
          description="Indicateur d'état de session/CU"
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
          title="GapDisplay"
          description="Affichage de l'écart entre pilotes"
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
          title="Leaderboard"
          description="Classement en temps réel de la session"
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
          title="FreePracticeLeaderboard"
          description="Classement avec filtres Tours/Temps pour essais libres"
          componentName="FreePracticeLeaderboard"
          code="<FreePracticeLeaderboard />"
        />
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
          <FreePracticeLeaderboard
            freePracticeBoard={demoFreePracticeBoard}
            configs={demoConfigs}
            onReset={() => {}}
          />
        </div>
      </section>

    </>
  )
}

// Championship Displays Tab
function ChampionshipDisplays({ drivers, cars, loading }) {
  const [sessionType, setSessionType] = useState('practice')

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
      case 'practice':
        return baseData.map((entry, idx) => ({
          ...entry,
          laps: 12 - idx * 2,
          bestLap: 5100 + idx * 80,
          lastLap: 5200 + idx * 100,
          gap: idx === 0 ? null : `+${(idx * 0.8).toFixed(1)}s`,
        }))
      case 'qualif':
        return baseData.map((entry, idx) => ({
          ...entry,
          laps: 5,
          bestLap: 5050 + idx * 120,
          lastLap: 5100 + idx * 150,
          gap: idx === 0 ? null : `+${(idx * 0.12).toFixed(3)}s`,
        }))
      case 'race':
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
    practice: { label: 'Essais Libres', icon: BeakerIcon, color: 'bg-gray-500' },
    qualif: { label: 'Qualifications', icon: ClockIcon, color: 'bg-purple-500' },
    race: { label: 'Course', icon: FlagIcon, color: 'bg-green-500' },
  }

  const currentSession = sessionTypeLabels[sessionType]
  const SessionIcon = currentSession.icon

  return (
    <>
      {/* Session Type Selector */}
      <section>
        <SectionHeader
          title="Types de Session"
          description="Sélectionnez le type de session pour voir les différents états"
          componentName="SessionType"
          code="sessionType: 'practice' | 'qualif' | 'race'"
        />
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex gap-3 mb-4">
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
            <span>Session active:</span>
            <span className={`inline-flex items-center gap-1 px-2 py-1 ${currentSession.color} text-white rounded-full text-xs font-medium`}>
              <SessionIcon className="w-3 h-3" />
              {currentSession.label}
            </span>
          </div>
        </div>
      </section>

      {/* Session Status Badges */}
      <section>
        <SectionHeader
          title="Badges de Statut"
          description="Indicateurs d'état de la session"
          componentName="SessionStatus"
          code="status: 'draft' | 'active' | 'finishing' | 'finished'"
        />
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow flex flex-wrap gap-3">
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
            draft
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300">
            En cours
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 animate-pulse">
            🏁 Fin de session...
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
            Terminé
          </span>
        </div>
      </section>

      {/* Leaderboard by Session Type */}
      <section>
        <SectionHeader
          title={`Leaderboard - ${currentSession.label}`}
          description={
            sessionType === 'practice' ? 'Classement par nombre de tours, puis meilleur temps' :
            sessionType === 'qualif' ? 'Classement par meilleur temps au tour' :
            'Classement par tours complétés, avec écarts'
          }
          componentName="Leaderboard"
          code={`<Leaderboard sessionType="${sessionType}" />`}
        />
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden p-4">
          <div className="flex items-center gap-2 mb-4">
            <SessionIcon className={`w-5 h-5 ${
              sessionType === 'practice' ? 'text-gray-500' :
              sessionType === 'qualif' ? 'text-purple-500' :
              'text-green-500'
            }`} />
            <span className="font-semibold text-gray-700 dark:text-gray-200">{currentSession.label}</span>
            {sessionType === 'qualif' && (
              <span className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
                <ClockIcon className="w-3 h-3" />
                5 tours max
              </span>
            )}
            {sessionType === 'race' && (
              <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                <ArrowPathIcon className="w-3 h-3" />
                25 tours
              </span>
            )}
          </div>
          <Leaderboard leaderboard={demoLeaderboard} />
        </div>
      </section>

      {/* FreePracticeLeaderboard with sort options */}
      <section>
        <SectionHeader
          title="FreePracticeLeaderboard"
          description="Classement essais libres avec filtres Tours/Temps"
          componentName="FreePracticeLeaderboard"
          code="<FreePracticeLeaderboard />"
        />
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
          <FreePracticeLeaderboard
            freePracticeBoard={demoFreePracticeBoard}
            configs={demoConfigs}
            onReset={() => {}}
          />
        </div>
      </section>

      {/* Standings Panel Example */}
      <section>
        <SectionHeader
          title="Panneau Classement Général"
          description="Onglets Libre / Qualif / Course avec classements cumulés"
          componentName="StandingsPanel"
          code="<StandingsPanel />"
        />
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b dark:border-gray-700">
            <h3 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
              <TrophyIcon className="w-5 h-5 text-yellow-500" />
              Classement Général
            </h3>
          </div>
          <div className="flex border-b dark:border-gray-700">
            <button className="flex-1 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 border-b-2 border-transparent">
              <BeakerIcon className="w-4 h-4 inline mr-1" />
              Libre
            </button>
            <button className="flex-1 py-2 text-sm font-medium text-purple-600 dark:text-purple-400 border-b-2 border-purple-500">
              <ClockIcon className="w-4 h-4 inline mr-1" />
              Qualif
            </button>
            <button className="flex-1 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 border-b-2 border-transparent">
              <FlagIcon className="w-4 h-4 inline mr-1" />
              Course
            </button>
          </div>
          <div className="p-4 space-y-2">
            {drivers.slice(0, 4).map((driver, idx) => (
              <div
                key={driver.id}
                className={`flex items-center gap-3 p-2 rounded-lg ${
                  idx === 0 ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700' :
                  idx === 1 ? 'bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600' :
                  idx === 2 ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700' :
                  'bg-gray-50 dark:bg-gray-700/50'
                }`}
              >
                <span className={`w-6 text-center font-bold ${
                  idx === 0 ? 'text-yellow-600 dark:text-yellow-400' :
                  idx === 1 ? 'text-gray-500 dark:text-gray-400' :
                  idx === 2 ? 'text-orange-600 dark:text-orange-400' :
                  'text-gray-700 dark:text-gray-300'
                }`}>
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

// CRUD Displays Tab
function CRUDDisplays({ drivers, cars, tracks, loading }) {
  const [showModal, setShowModal] = useState(false)
  const [view, setView] = useState('grid')

  if (loading) return <LoadingState />

  const demoDriver = drivers[0]

  return (
    <>
      {/* PageHeader */}
      <section>
        <SectionHeader
          title="PageHeader"
          description="En-tête de page CRUD avec titre, recherche et bouton d'action"
          componentName="PageHeader"
          code="<PageHeader />"
        />
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <PageHeader
            title="Pilotes"
            searchValue=""
            onSearchChange={() => {}}
            onAdd={() => setShowModal(true)}
            addLabel="Ajouter un pilote"
          />
        </div>
      </section>

      {/* ViewToggleButtons */}
      <section>
        <SectionHeader
          title="ViewToggleButtons"
          description="Toggle entre vue grille et liste"
          componentName="ViewToggleButtons"
          code="<ViewToggleButtons />"
        />
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <ViewToggleButtons mode={view} onChange={setView} />
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Vue actuelle: {view}</p>
        </div>
      </section>

      {/* EmptyState */}
      <section>
        <SectionHeader
          title="EmptyState"
          description="État vide pour les listes sans données"
          componentName="EmptyState"
          code="<EmptyState />"
        />
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <EmptyState
            icon={<UserGroupIcon className="w-8 h-8" />}
            title="Aucun pilote"
            message="Commencez par ajouter votre premier pilote"
            actionLabel="Ajouter un pilote"
            onAction={() => {}}
          />
        </div>
      </section>

      {/* EntityCard */}
      <section>
        <SectionHeader
          title="EntityCard"
          description="Carte d'entité générique avec image et stats"
          componentName="EntityCard"
          code="<EntityCard />"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {drivers.slice(0, 3).map(driver => (
            <EntityCard
              key={driver.id}
              image={driver.img}
              title={driver.name}
              subtitle={driver.team?.name || 'Sans équipe'}
              color={driver.color}
              onClick={() => {}}
              onEdit={() => {}}
              onDelete={() => {}}
            >
              <StatBadge label="Courses" value={driver._count?.sessions || 0} />
              <StatBadge label="Tours" value={driver._count?.laps || 0} />
            </EntityCard>
          ))}
        </div>
      </section>

      {/* StatBadge */}
      <section>
        <SectionHeader
          title="StatBadge"
          description="Badge de statistique pour EntityCard"
          componentName="StatBadge"
          code="<StatBadge label='Tours' value={42} />"
        />
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow flex gap-4">
          <StatBadge label="Courses" value={15} />
          <StatBadge label="Tours" value={234} />
          <StatBadge label="Victoires" value={3} />
          <StatBadge label="Podiums" value={8} />
        </div>
      </section>

      {/* ColorPickerField */}
      <section>
        <SectionHeader
          title="ColorPickerField"
          description="Sélecteur de couleur pour formulaires"
          componentName="ColorPickerField"
          code="<ColorPickerField />"
        />
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow max-w-md">
          <ColorPickerField
            label="Couleur du pilote"
            value={demoDriver?.color || '#3B82F6'}
            onChange={() => {}}
          />
        </div>
      </section>

      {/* RangeField */}
      <section>
        <SectionHeader
          title="RangeField"
          description="Slider pour valeurs numériques (ex: vitesse, accélération)"
          componentName="RangeField"
          code="<RangeField />"
        />
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow max-w-md">
          <RangeField
            label="Vitesse max"
            value={80}
            onChange={() => {}}
            min={0}
            max={100}
          />
        </div>
      </section>

      {/* ErrorMessage */}
      <section>
        <SectionHeader
          title="ErrorMessage"
          description="Affichage des messages d'erreur"
          componentName="ErrorMessage"
          code="<ErrorMessage message='...' />"
        />
        <div className="space-y-4">
          <ErrorMessage message="Une erreur s'est produite lors du chargement des données." />
        </div>
      </section>

      {/* Modal Demo */}
      {showModal && (
        <Modal title="Exemple de Modal" onClose={() => setShowModal(false)}>
          <p className="text-gray-600 mb-4">Contenu de la modal avec FormField</p>
          <FormField label="Nom">
            <TextField value="" onChange={() => {}} placeholder="Entrez un nom" />
          </FormField>
          <ModalFooter>
            <ModalButton variant="secondary" onClick={() => setShowModal(false)}>
              Annuler
            </ModalButton>
            <ModalButton variant="primary" onClick={() => setShowModal(false)}>
              Sauvegarder
            </ModalButton>
          </ModalFooter>
        </Modal>
      )}
    </>
  )
}

// Config Displays Tab
function ConfigDisplays({ drivers, cars, loading }) {
  if (loading) return <LoadingState />

  const demoConfigs = drivers.slice(0, 6).map((driver, idx) => ({
    controller: String(idx + 1),
    driver: idx < 3 ? driver : null,
    car: idx < 3 ? cars[idx] : null,
    driverId: idx < 3 ? driver.id : null,
    carId: idx < 3 ? cars[idx]?.id : null,
  }))

  return (
    <>
      {/* ConfigStatus */}
      <section>
        <SectionHeader
          title="ConfigStatus"
          description="Indicateur de statut de configuration des controllers"
          componentName="ConfigStatus"
          code="<ConfigStatus />"
        />
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Configuration incomplète (3 manquantes)</p>
            <ConfigStatus
              unconfiguredCount={3}
              unconfiguredSlots={[4, 5, 6]}
              isComplete={false}
            />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Configuration complète</p>
            <ConfigStatus
              unconfiguredCount={0}
              unconfiguredSlots={[]}
              isComplete={true}
            />
          </div>
        </div>
      </section>

      {/* ControllerConfigSection */}
      <section>
        <SectionHeader
          title="ControllerConfigSection"
          description="Section de configuration des controllers avec pilotes/voitures"
          componentName="ControllerConfigSection"
          code="<ControllerConfigSection />"
        />
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <ControllerConfigSection
            expanded={true}
            onToggle={() => {}}
            configs={demoConfigs}
            drivers={drivers}
            cars={cars}
            onConfigChange={() => {}}
            isComplete={false}
            unconfiguredSlots={[4, 5, 6]}
          />
        </div>
      </section>
    </>
  )
}

// Unused Components Tab
function UnusedDisplays({ drivers, cars, loading }) {
  if (loading) return <LoadingState />

  const unusedComponents = Object.entries(COMPONENT_USAGE)
    .filter(([, usage]) => usage.length === 0)
    .map(([name]) => name)

  return (
    <>
      <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg p-6 mb-8">
        <h2 className="text-lg font-semibold text-orange-800 dark:text-orange-300 mb-2">
          Composants non utilisés ({unusedComponents.length})
        </h2>
        <p className="text-orange-700 dark:text-orange-400 text-sm mb-4">
          Ces composants existent dans le codebase mais ne sont importés nulle part.
          Ils peuvent être utiles pour de futures fonctionnalités ou peuvent être supprimés.
        </p>
        <div className="flex flex-wrap gap-2">
          {unusedComponents.map(name => (
            <span key={name} className="px-3 py-1 bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300 rounded-full text-sm font-medium">
              {name}
            </span>
          ))}
        </div>
      </div>

      {/* DriverBadge - Unused in pages */}
      <section>
        <SectionHeader
          title="DriverBadge"
          description="Badges compacts - disponible mais non utilisé dans les pages"
          componentName="DriverBadge"
          code="<DriverBadge />"
        />
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex flex-wrap gap-3">
            {drivers.slice(0, 4).map((driver) => (
              <DriverBadge key={driver.id} driver={driver} size="md" showName={true} />
            ))}
          </div>
        </div>
      </section>

      {/* DriverGridPosition - Unused */}
      <section>
        <SectionHeader
          title="DriverGridPosition"
          description="Grille de départ - disponible mais non utilisé"
          componentName="DriverGridPosition"
          code="<DriverGridPosition />"
        />
        <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-lg flex gap-4">
          {drivers.slice(0, 2).map((driver, idx) => (
            <DriverGridPosition key={driver.id} driver={driver} row={1} side={idx === 0 ? 'left' : 'right'} />
          ))}
        </div>
      </section>

      {/* DriverStanding - Unused */}
      <section>
        <SectionHeader
          title="DriverStanding"
          description="Classement pilote - disponible mais non utilisé"
          componentName="DriverStanding"
          code="<DriverStanding />"
        />
        <div className="space-y-2">
          {drivers.slice(0, 3).map((driver, idx) => (
            <DriverStanding
              key={driver.id}
              driver={driver}
              position={idx + 1}
              points={25 - idx * 7}
              change={idx === 0 ? 1 : idx === 1 ? -1 : 0}
            />
          ))}
        </div>
      </section>

      {/* DriverSelectCard - Unused */}
      <section>
        <SectionHeader
          title="DriverSelectCard"
          description="Carte de sélection - disponible mais non utilisé"
          componentName="DriverSelectCard"
          code="<DriverSelectCard />"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {drivers.slice(0, 3).map((driver) => (
            <DriverSelectCard
              key={driver.id}
              driver={driver}
              selected={false}
              onToggle={() => {}}
            />
          ))}
        </div>
      </section>

      {/* EntityCard - Unused */}
      <section>
        <SectionHeader
          title="EntityCard"
          description="Carte d'entité générique - disponible mais non utilisé"
          componentName="EntityCard"
          code="<EntityCard />"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {drivers.slice(0, 2).map(driver => (
            <EntityCard
              key={driver.id}
              image={driver.img}
              title={driver.name}
              subtitle="Exemple d'entité"
              color={driver.color}
              onClick={() => {}}
            >
              <StatBadge label="Stat" value={42} />
            </EntityCard>
          ))}
        </div>
      </section>

      {/* StatBadge - Unused */}
      <section>
        <SectionHeader
          title="StatBadge"
          description="Badge de statistique - disponible mais non utilisé"
          componentName="StatBadge"
          code="<StatBadge />"
        />
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow flex gap-4">
          <StatBadge label="Demo 1" value={100} />
          <StatBadge label="Demo 2" value={50} />
        </div>
      </section>
    </>
  )
}

// Loading state component
function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">Chargement...</p>
      </div>
    </div>
  )
}
