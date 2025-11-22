import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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
import Sessions from './pages/Sessions'
import Settings from './pages/Settings'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Main layout with sidebar */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="drivers" element={<Drivers />} />
          <Route path="drivers/:id" element={<DriverProfile />} />
          <Route path="cars" element={<Cars />} />
          <Route path="tracks" element={<Tracks />} />
          <Route path="teams" element={<Teams />} />
          <Route path="sessions" element={<Sessions />} />
          <Route path="settings" element={<Settings />} />
          <Route path="displays" element={<Displays />} />
          <Route path="demo-displays" element={<DriverDisplayDemo />} />
        </Route>

        {/* Legacy home (simulator) */}
        <Route path="/simulator" element={<Home />} />

        {/* Redirect unknown routes */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
