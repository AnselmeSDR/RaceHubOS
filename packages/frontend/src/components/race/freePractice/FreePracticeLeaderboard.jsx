import { useState, useMemo } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Flag, Clock, RefreshCw } from 'lucide-react'
import FreePracticeEntry from './FreePracticeEntry'

const SORT_OPTIONS = {
    LAPS: 'laps',
    BEST_TIME: 'bestTime'
}

export default function FreePracticeLeaderboard({
    freePracticeBoard,
    configs,
    onReset
}) {
    const [sortBy, setSortBy] = useState(SORT_OPTIONS.LAPS)

    const entries = useMemo(() => {
        const mapped = Object.entries(freePracticeBoard)
            .map(([ctrl, data]) => {
                const config = configs.find(c => String(c.controller) === ctrl)
                const driver = config?.driver
                const car = config?.car
                return { controller: ctrl, ...data, driver, car }
            })

        // Sort based on selected option
        if (sortBy === SORT_OPTIONS.BEST_TIME) {
            return mapped.sort((a, b) => {
                // Sort by best lap time (ascending) - fastest first
                if (!a.bestLap && !b.bestLap) return 0
                if (!a.bestLap) return 1
                if (!b.bestLap) return -1
                return a.bestLap - b.bestLap
            })
        }

        // Default: sort by laps (descending), then best time (ascending)
        return mapped.sort((a, b) => {
            if (b.laps !== a.laps) return b.laps - a.laps
            if (!a.bestLap && !b.bestLap) return 0
            if (!a.bestLap) return 1
            if (!b.bestLap) return -1
            return a.bestLap - b.bestLap
        })
    }, [freePracticeBoard, configs, sortBy])

    return (
        <div className="flex-1 bg-gray-50 overflow-y-auto p-6">
            <div className="bg-white rounded-xl shadow-sm border">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                    <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                        <Flag className="w-5 h-5 text-green-500" />
                        Classement
                    </h2>

                    <div className="flex items-center gap-2">
                        {/* Sort filters */}
                        <div className="flex bg-gray-100 rounded-lg p-1">
                            <button
                                onClick={() => setSortBy(SORT_OPTIONS.LAPS)}
                                className={`flex items-center gap-1 px-3 py-1 text-sm rounded-md transition-colors ${
                                    sortBy === SORT_OPTIONS.LAPS
                                        ? 'bg-white text-gray-800 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <RefreshCw className="w-4 h-4" />
                                Tours
                            </button>
                            <button
                                onClick={() => setSortBy(SORT_OPTIONS.BEST_TIME)}
                                className={`flex items-center gap-1 px-3 py-1 text-sm rounded-md transition-colors ${
                                    sortBy === SORT_OPTIONS.BEST_TIME
                                        ? 'bg-white text-gray-800 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <Clock className="w-4 h-4" />
                                Temps
                            </button>
                        </div>

                        <button
                            onClick={onReset}
                            className="text-sm text-gray-500 hover:text-gray-700"
                        >
                            Réinitialiser
                        </button>
                    </div>
                </div>

                {entries.length === 0 ? (
                    <div className="px-4 py-12 text-center text-gray-400">
                        <Flag className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>En attente des tours...</p>
                        <p className="text-sm mt-1">Roulez sur le circuit</p>
                    </div>
                ) : (
                    <div className="p-4 space-y-2">
                        <AnimatePresence mode="popLayout">
                            {entries.map((entry, index) => (
                                <FreePracticeEntry
                                    key={entry.controller}
                                    entry={entry}
                                    index={index}
                                />
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    )
}
