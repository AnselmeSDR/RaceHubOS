import { useEffect, useState, useRef } from 'react'
import { useDevice } from '../../context/DeviceContext'

/**
 * StartLights - F1-style start lights animation
 * Consumes cuStatus directly from DeviceContext
 */
export default function StartLights() {
  const { cuStatus, startRace } = useDevice()
  const cuStart = cuStatus?.start ?? 9

  const [showGo, setShowGo] = useState(false)
  const [visible, setVisible] = useState(false)
  const prevStart = useRef(cuStart)
  const wasInSequence = useRef(false)

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

          {/* Waiting indicator at lights 1 */}
          {showStartButton && (
            <p className="text-zinc-400 text-sm animate-pulse">
              Appuyez pour lancer le décompte
            </p>
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
