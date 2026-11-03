import React, { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { VoiceProvider, useVoice } from '../../src/context/VoiceContext'
import i18n from '../../src/i18n'
export function Probe() {
  const voice = useVoice()
  useEffect(() => {
    window.__voiceProbe = { ...voice, i18n }
  }, [voice])
  return React.createElement('div', { 'data-testid': 'voice-probe' }, 'ready')
}
createRoot(document.getElementById('root')).render(React.createElement(VoiceProvider, null, React.createElement(Probe)))
