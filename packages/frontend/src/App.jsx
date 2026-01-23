import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { DeviceProvider } from './context/DeviceContext'
import { SessionProvider } from './context/SessionContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Drivers from './pages/Drivers'
import DriverProfile from './pages/DriverProfile'
import Cars from './pages/Cars'
import CarProfile from './pages/CarProfile'
import Tracks from './pages/Tracks'
import TrackProfile from './pages/TrackProfile'
import Teams from './pages/Teams'
import Home from './pages/Home'
import Displays from './pages/Displays'
import DriverDisplayDemo from './pages/DriverDisplayDemo'
import SessionsList from './pages/SessionsList'
import SessionDetail from './pages/SessionDetail'
import Stats from './pages/Stats'
import Settings from './pages/Settings'
import Test from './pages/Test'
import FreeSessionPage from './pages/FreeSessionPage'
import Championships from './pages/Championships'
import ChampionshipDetail from './pages/ChampionshipDetail'

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <DeviceProvider>
          <SessionProvider>
          <Routes>
          {/* Main layout with sidebar */}
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            {/* Free session mode */}
            <Route path="race" element={<FreeSessionPage />} />
            {/* Championships */}
            <Route path="championships" element={<Championships />} />
            <Route path="championships/:id" element={<ChampionshipDetail />} />
            {/* Core routes */}
            <Route path="drivers" element={<Drivers />} />
            <Route path="drivers/:id" element={<DriverProfile />} />
            <Route path="cars" element={<Cars />} />
            <Route path="cars/:id" element={<CarProfile />} />
            <Route path="tracks" element={<Tracks />} />
            <Route path="tracks/:id" element={<TrackProfile />} />
            <Route path="teams" element={<Teams />} />
            {/* Session history */}
            <Route path="sessions" element={<SessionsList />} />
            <Route path="sessions/:id" element={<SessionDetail />} />
            <Route path="history" element={<SessionsList />} />
            {/* Utils */}
            <Route path="stats" element={<Stats />} />
            <Route path="settings" element={<Settings />} />
            <Route path="displays" element={<Displays />} />
            <Route path="demo-displays" element={<DriverDisplayDemo />} />
            <Route path="test" element={<Test />} />
          </Route>

          {/* Legacy home (simulator) */}
          <Route path="/simulator" element={<Home />} />

          {/* Redirect old routes */}
          <Route path="/practice" element={<Navigate to="/race" replace />} />

          {/* Redirect unknown routes */}
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </SessionProvider>
        </DeviceProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
