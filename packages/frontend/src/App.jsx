import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { DeviceProvider } from './context/DeviceContext'
import { SessionProvider } from './context/SessionContext'
import Layout from './components/Layout'

// Lazy load all pages
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Drivers = lazy(() => import('./pages/Drivers'))
const DriverProfile = lazy(() => import('./pages/DriverProfile'))
const Cars = lazy(() => import('./pages/Cars'))
const CarProfile = lazy(() => import('./pages/CarProfile'))
const Tracks = lazy(() => import('./pages/Tracks'))
const TrackProfile = lazy(() => import('./pages/TrackProfile'))
const Teams = lazy(() => import('./pages/Teams'))
const Displays = lazy(() => import('./pages/Displays'))
const DriverDisplayDemo = lazy(() => import('./pages/DriverDisplayDemo'))
const SessionsList = lazy(() => import('./pages/SessionsList'))
const SessionDetail = lazy(() => import('./pages/SessionDetail'))
const Stats = lazy(() => import('./pages/Stats'))
const Settings = lazy(() => import('./pages/Settings'))
const Test = lazy(() => import('./pages/Test'))
const FreeSessionPage = lazy(() => import('./pages/FreeSessionPage'))
const Championships = lazy(() => import('./pages/Championships'))
const ChampionshipDetail = lazy(() => import('./pages/ChampionshipDetail'))

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <DeviceProvider>
          <SessionProvider>
          <Routes>
          {/* Main layout with sidebar */}
          <Route path="/" element={<Layout />}>
            <Route index element={<Suspense><Dashboard /></Suspense>} />
            {/* Free session mode */}
            <Route path="race" element={<Suspense><FreeSessionPage /></Suspense>} />
            {/* Championships */}
            <Route path="championships" element={<Suspense><Championships /></Suspense>} />
            <Route path="championships/:id" element={<Suspense><ChampionshipDetail /></Suspense>} />
            {/* Core routes */}
            <Route path="drivers" element={<Suspense><Drivers /></Suspense>} />
            <Route path="drivers/:id" element={<Suspense><DriverProfile /></Suspense>} />
            <Route path="cars" element={<Suspense><Cars /></Suspense>} />
            <Route path="cars/:id" element={<Suspense><CarProfile /></Suspense>} />
            <Route path="tracks" element={<Suspense><Tracks /></Suspense>} />
            <Route path="tracks/:id" element={<Suspense><TrackProfile /></Suspense>} />
            <Route path="teams" element={<Suspense><Teams /></Suspense>} />
            {/* Session history */}
            <Route path="sessions" element={<Suspense><SessionsList /></Suspense>} />
            <Route path="sessions/:id" element={<Suspense><SessionDetail /></Suspense>} />
            <Route path="history" element={<Suspense><SessionsList /></Suspense>} />
            {/* Utils */}
            <Route path="stats" element={<Suspense><Stats /></Suspense>} />
            <Route path="settings" element={<Suspense><Settings /></Suspense>} />
            <Route path="displays" element={<Suspense><Displays /></Suspense>} />
            <Route path="demo-displays" element={<Suspense><DriverDisplayDemo /></Suspense>} />
            <Route path="test" element={<Suspense><Test /></Suspense>} />
          </Route>

          {/* Routes without sidebar */}
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </SessionProvider>
        </DeviceProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
