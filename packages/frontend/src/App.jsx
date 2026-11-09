import { BrowserRouter } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { DeviceProvider } from './context/DeviceContext'
import { SessionProvider } from './context/SessionContext'
import { VoiceProvider } from './context/VoiceContext'
import { TooltipProvider } from './components/ui/tooltip'
import AppRoutes from './AppRoutes'

function App() {
  return (
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
  )
}

export default App
