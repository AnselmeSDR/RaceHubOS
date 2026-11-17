import { BrowserRouter } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { AppProvider } from './context/AppContext'
import { DeviceProvider } from './context/DeviceContext'
import { SessionProvider } from './context/SessionContext'
import { VoiceProvider } from './context/VoiceContext'
import { TooltipProvider } from './components/ui/tooltip'
import AppRoutes from './AppRoutes'

function App() {
  return (
    // Every animation is cut when the system asks for reduced motion
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <AppProvider>
          <DeviceProvider>
            <VoiceProvider>
              <SessionProvider>
                <TooltipProvider>
                  <AppRoutes />
                </TooltipProvider>
              </SessionProvider>
            </VoiceProvider>
          </DeviceProvider>
        </AppProvider>
      </BrowserRouter>
    </MotionConfig>
  )
}

export default App
