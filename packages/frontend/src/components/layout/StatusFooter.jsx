import { useTranslation } from 'react-i18next'
import { SIMULATOR_ADDRESS, useDevice } from '@/context/DeviceContext'
import { cuStateColor, cuStateLabel } from './cuState'

const SEPARATOR = <span className="text-muted-foreground/40 mx-1">|</span>

/** The last timing line crossed: a sector, or the finish with the lap time. */
function LastTimer({ timer }) {
  const { t } = useTranslation('layout')
  if (!timer.isFinishLine) return <span className="text-yellow-500 ml-1">S{timer.sector}</span>
  return (
    <span className="text-green-500 ml-1">
      {timer.lapTime > 0 ? `${(timer.lapTime / 1000).toFixed(3)}s` : t('footer.lapStart')}
    </span>
  )
}

/** The device connected (Control Unit or simulator), its light state and mode, and the last timer. */
export default function StatusFooter() {
  const { t } = useTranslation('layout')
  const { cuStatus, connected, deviceAddress, lastTimer } = useDevice()
  const isSimulator = deviceAddress === SIMULATOR_ADDRESS
  const deviceColor = !connected ? 'text-red-500' : isSimulator ? 'text-purple-400' : 'text-green-500'
  const deviceLabel = !connected ? t('footer.noCu') : isSimulator ? t('footer.simulator') : t('footer.cu')

  return (
    <footer
      data-testid="status-footer"
      className="flex h-8 shrink-0 items-center gap-1 border-t px-4 text-xs font-mono text-muted-foreground"
    >
      <div className={`size-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className={deviceColor}>{deviceLabel}</span>
      {SEPARATOR}
      <span className={cuStateColor(cuStatus?.start)}>{cuStateLabel(t, cuStatus?.start)}</span>
      {SEPARATOR}
      <span>{t('footer.mode', { mode: cuStatus?.mode ?? '-' })}</span>
      {lastTimer && (
        <>
          {SEPARATOR}
          <span className="text-blue-400">C{lastTimer.controller + 1}</span>
          <LastTimer timer={lastTimer} />
        </>
      )}
    </footer>
  )
}
