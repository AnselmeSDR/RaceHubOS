import { Wifi, WifiOff } from 'lucide-react'
import StateChip from '../StateChip'

export default function SessionHeader({
    sessionName,
    sessionTypeLabel,
    status,
    cuConnected,
    elapsedFormatted,
    remaining,
    remainingFormatted,
    progress
}) {
    return (
        <header className="bg-black/50 backdrop-blur-sm border-b border-gray-700 px-6 py-4">
            <div className="flex items-center justify-between">
                {/* Left: Session info */}
                <div>
                    <h1 className="text-xl font-bold text-white">
                        {sessionName || sessionTypeLabel}
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-gray-400 uppercase tracking-wide">
                            {sessionTypeLabel}
                        </span>
                        <StateChip status={status} />
                    </div>
                </div>

                {/* Center: Timer */}
                <div className="flex items-center gap-6">
                    <div className="text-center">
                        <div className="text-xs text-gray-500 uppercase">Temps</div>
                        <div className="text-3xl font-mono font-bold text-white tabular-nums">
                            {elapsedFormatted}
                        </div>
                    </div>
                    {remaining !== null && (
                        <>
                            <div className="w-px h-10 bg-gray-700" />
                            <div className="text-center">
                                <div className="text-xs text-gray-500 uppercase">Restant</div>
                                <div className={`text-3xl font-mono font-bold tabular-nums ${
                                    remaining < 60000 ? 'text-red-500 animate-pulse' : 'text-white'
                                }`}>
                                    {remainingFormatted}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Right: CU status */}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                    cuConnected ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
                }`}>
                    {cuConnected ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
                    <span className="text-sm font-medium">{cuConnected ? 'CU OK' : 'CU Off'}</span>
                </div>
            </div>

            {/* Progress bar */}
            {remaining !== null && progress > 0 && (
                <div className="mt-4 h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-all duration-1000 rounded-full ${
                            progress > 90 ? 'bg-red-500' : progress > 70 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}
        </header>
    )
}
