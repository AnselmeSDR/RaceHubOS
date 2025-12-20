import { AnimatePresence } from 'framer-motion'
import { FlagIcon } from '@heroicons/react/24/outline'
import FreePracticeEntry from './FreePracticeEntry'

export default function FreePracticeLeaderboard({
    freePracticeBoard,
    configs,
    onReset
}) {
    const entries = Object.entries(freePracticeBoard)
        .map(([ctrl, data]) => {
            const config = configs.find(c => String(c.controller) === ctrl)
            const driver = config?.driver
            const car = config?.car
            return { controller: ctrl, ...data, driver, car }
        })
        .sort((a, b) => {
            if (b.laps !== a.laps) return b.laps - a.laps
            if (!a.bestLap) return 1
            if (!b.bestLap) return -1
            return a.bestLap - b.bestLap
        })

    return (
        <div className="flex-1 bg-gray-50 overflow-y-auto p-6">
            <div className="bg-white rounded-xl shadow-sm border">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                    <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                        <FlagIcon className="w-5 h-5 text-green-500" />
                        Classement
                    </h2>
                    <button
                        onClick={onReset}
                        className="text-sm text-gray-500 hover:text-gray-700"
                    >
                        Réinitialiser
                    </button>
                </div>

                {entries.length === 0 ? (
                    <div className="px-4 py-12 text-center text-gray-400">
                        <FlagIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
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
