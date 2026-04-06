import { useEffect, useState, useRef, useCallback } from 'react'
import { X } from 'lucide-react'
import { useDevice } from '../../context/DeviceContext'

/**
 * StartLights - F1-style start lights animation
 * Consumes cuStatus directly from DeviceContext
 */
export default function StartLights({ onCancel }) {
  const { cuStatus, startRace } = useDevice()
  const cuStart = cuStatus?.start ?? 9

  const [showGo, setShowGo] = useState(false)
  const [visible, setVisible] = useState(false)
  const prevStart = useRef(cuStart)
  const wasInSequence = useRef(false)

  const audioCtxRef = useRef(null)

  const playBeep = useCallback((freq = 800, duration = 0.15) => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
      const ctx = audioCtxRef.current
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.4, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration)
      osc.start()
      osc.stop(ctx.currentTime + duration)
    } catch {}
  }, [])

  // Play sound on each light change
  useEffect(() => {
    if (cuStart >= 1 && cuStart <= 5) {
      playBeep(600, 0.2)
    } else if ((cuStart === 7 || cuStart === 0) && wasInSequence.current) {
      playBeep(1200, 0.5)
    } else if (cuStart === 6) {
      playBeep(300, 0.4)
    }
  }, [cuStart, playBeep])

  const handleCancel = useCallback(() => {
    if (onCancel) onCancel()
  }, [onCancel])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') handleCancel()
      if (e.key === ' ' && cuStart === 1) {
        e.preventDefault()
        startRace()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleCancel])

  useEffect(() => {
    if (cuStart >= 1 && cuStart <= 5) {
      wasInSequence.current = true
    }
  }, [cuStart])

  useEffect(() => {
    if (cuStart >= 1 && cuStart <= 7) {
      setVisible(true)
    } else if (cuStart === 0 && wasInSequence.current) {
      const timer = setTimeout(() => {
        setVisible(false)
        wasInSequence.current = false
      }, 2500)
      return () => clearTimeout(timer)
    } else {
      setVisible(false)
    }
    prevStart.current = cuStart
  }, [cuStart])

  useEffect(() => {
    const wasLights = prevStart.current >= 1 && prevStart.current <= 7
    if ((cuStart === 7 || cuStart === 0) && wasLights && wasInSequence.current) {
      setShowGo(true)
      const timer = setTimeout(() => setShowGo(false), 2500)
      return () => clearTimeout(timer)
    }
  }, [cuStart])

  if (!visible && !showGo) return null

  const isLightsOn = cuStart >= 1 && cuStart <= 5
  const isFalseStart = cuStart === 6
  const showStartButton = cuStart === 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-black/90 via-black/85 to-black/90 backdrop-blur-md">
      {/* Cancel button */}
      {onCancel && (
        <button
          onClick={handleCancel}
          className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors z-10"
          title="Annuler (Échap)"
        >
          <X className="size-6" />
        </button>
      )}
      {/* Ambient glow effect */}
      <div className={`absolute inset-0 transition-opacity duration-500 ${
        showGo ? 'opacity-30' : isLightsOn ? 'opacity-20' : 'opacity-0'
      }`}>
        <div className={`absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full blur-3xl ${
          showGo ? 'bg-green-500' : isFalseStart ? 'bg-orange-500' : 'bg-red-500'
        }`} />
      </div>

      <div className="relative flex flex-col items-center gap-10">
        {/* Light bar frame */}
        <div className="relative">
          {/* Frame background */}
          <div className="absolute -inset-4 bg-gradient-to-b from-zinc-700 via-zinc-800 to-zinc-900 rounded-2xl shadow-2xl" />
          <div className="absolute -inset-3 bg-gradient-to-b from-zinc-800 to-zinc-900 rounded-xl" />

          {/* Lights container */}
          <div className="relative flex gap-4 p-3">
            {[1, 2, 3, 4, 5].map((light) => (
              <LightColumn
                key={light}
                active={isLightsOn && cuStart >= light}
                isFalseStart={isFalseStart}
                isGo={showGo && !isFalseStart}
                index={light}
              />
            ))}
          </div>
        </div>

        {/* Status / Button */}
        <div className="flex flex-col items-center gap-6">
          {/* Countdown text */}
          {isLightsOn && !showStartButton && (
            <div className="text-center">
              <span className="text-6xl font-black text-red-500 drop-shadow-[0_0_30px_rgba(239,68,68,0.8)] animate-pulse tabular-nums">
                {cuStart}
              </span>
              <span className="text-4xl font-bold text-red-400/60 ml-2">/ 5</span>
            </div>
          )}

          {/* False start */}
          {isFalseStart && (
            <div className="text-center animate-pulse">
              <span className="text-5xl font-black text-orange-500 drop-shadow-[0_0_30px_rgba(249,115,22,0.8)] tracking-wider">
                FAUX DÉPART
              </span>
            </div>
          )}

          {/* GO! */}
          {showGo && !isFalseStart && (
            <div className="text-center animate-bounce">
              <span className="text-8xl font-black text-green-400 drop-shadow-[0_0_50px_rgba(74,222,128,0.9)] tracking-wider">
                GO!
              </span>
            </div>
          )}

          {/* START button */}
          {showStartButton && (
            <button
              onClick={startRace}
              className="group relative overflow-hidden px-16 py-5 bg-gradient-to-b from-green-400 to-green-600 hover:from-green-300 hover:to-green-500 text-white text-3xl font-black rounded-2xl shadow-[0_0_40px_rgba(34,197,94,0.5)] hover:shadow-[0_0_60px_rgba(34,197,94,0.7)] transition-all duration-300 hover:scale-105 active:scale-95"
            >
              {/* Shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <span className="relative tracking-widest">START</span>
            </button>
          )}

        </div>
      </div>
    </div>
  )
}

/**
 * Light column with 2 circular lights
 */
function LightColumn({ active, isFalseStart, isGo, index }) {
  const baseColor = isGo
    ? 'from-green-400 to-green-600'
    : isFalseStart
    ? 'from-orange-400 to-orange-600'
    : active
    ? 'from-red-500 to-red-700'
    : 'from-zinc-800 to-zinc-900'

  const glowColor = isGo
    ? 'shadow-[0_0_30px_10px_rgba(74,222,128,0.6)]'
    : isFalseStart
    ? 'shadow-[0_0_30px_10px_rgba(249,115,22,0.6)]'
    : active
    ? 'shadow-[0_0_30px_10px_rgba(239,68,68,0.6)]'
    : 'shadow-none'

  const isLit = active || isGo || isFalseStart

  return (
    <div className="flex flex-col gap-3 p-2 bg-zinc-950 rounded-lg border border-zinc-800">
      {[0, 1].map((i) => (
        <div
          key={i}
          className={`relative w-14 h-14 rounded-full transition-all duration-300 ${glowColor}`}
          style={{
            transitionDelay: isLit ? `${index * 50}ms` : '0ms'
          }}
        >
          {/* Light base */}
          <div className={`absolute inset-0 rounded-full bg-gradient-to-b ${baseColor} transition-all duration-300`} />

          {/* Glass reflection */}
          <div className="absolute inset-1 rounded-full bg-gradient-to-b from-white/30 via-transparent to-transparent opacity-50" />

          {/* Inner glow */}
          {isLit && (
            <div className={`absolute inset-2 rounded-full bg-gradient-to-b ${
              isGo ? 'from-green-300' : isFalseStart ? 'from-orange-300' : 'from-red-400'
            } to-transparent opacity-60 animate-pulse`} />
          )}

          {/* Center bright spot */}
          {isLit && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white/80 blur-sm" />
          )}
        </div>
      ))}
    </div>
  )
}
