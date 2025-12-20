import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { RaceProvider } from './context/RaceContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Drivers from './pages/Drivers'
import DriverProfile from './pages/DriverProfile'
import Cars from './pages/Cars'
import Tracks from './pages/Tracks'
import Teams from './pages/Teams'
import Home from './pages/Home'
import Displays from './pages/Displays'
import DriverDisplayDemo from './pages/DriverDisplayDemo'
import SessionsList from './pages/SessionsList'
import SessionDetail from './pages/SessionDetail'
import Stats from './pages/Stats'
import Settings from './pages/Settings'
import Test from './pages/Test'
import RacePage from './pages/RacePage'
import Championships from './pages/Championships'
import ChampionshipDetail from './pages/ChampionshipDetail'

function App() {
  return (
    <BrowserRouter>
      <RaceProvider>
        <Routes>
          {/* Main layout with sidebar */}
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            {/* Race - single page for free practice + sessions */}
            <Route path="race" element={<RacePage />} />
            {/* Championships */}
            <Route path="championships" element={<Championships />} />
            <Route path="championships/:id" element={<ChampionshipDetail />} />
            {/* Core routes */}
            <Route path="drivers" element={<Drivers />} />
            <Route path="drivers/:id" element={<DriverProfile />} />
            <Route path="cars" element={<Cars />} />
            <Route path="tracks" element={<Tracks />} />
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
      </RaceProvider>
    </BrowserRouter>
  )
}

export default App
