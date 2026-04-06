import { Play, Pause, Flag, Trophy, X } from 'lucide-react'

export default function SessionControls({
    isDraft,
    isRunning,
    isPaused,
    isResults,
    showResultsModal,
    canStart,
    canPause,
    canResume,
    canFinish,
    onStart,
    onPause,
    onResume,
    onFinish,
    onShowCancel,
    onShowResults
}) {
    return (
        <div className="bg-black/80 backdrop-blur-sm border-t border-gray-700 px-6 py-4">
            <div className="flex justify-center gap-4">
                {isDraft && (
                    <>
                        <button
                            onClick={onStart}
                            disabled={!canStart}
                            className="flex items-center gap-2 px-8 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg transition-all"
                        >
                            <Play className="w-6 h-6" />
                            Démarrer
                        </button>
                        <button
                            onClick={onShowCancel}
                            className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl"
                        >
                            <X className="w-6 h-6" />
                            Annuler
                        </button>
                    </>
                )}

                {isRunning && (
                    <>
                        <button
                            onClick={onPause}
                            disabled={!canPause}
                            className="flex items-center gap-2 px-6 py-3 bg-yellow-500 hover:bg-yellow-400 text-yellow-900 font-bold rounded-xl"
                        >
                            <Pause className="w-6 h-6" />
                            Pause
                        </button>
                        <button
                            onClick={onFinish}
                            disabled={!canFinish}
                            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl"
                        >
                            <Flag className="w-6 h-6" />
                            Terminer
                        </button>
                    </>
                )}

                {isPaused && (
                    <>
                        <button
                            onClick={onResume}
                            disabled={!canResume}
                            className="flex items-center gap-2 px-8 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl"
                        >
                            <Play className="w-6 h-6" />
                            Reprendre
                        </button>
                        <button
                            onClick={onFinish}
                            disabled={!canFinish}
                            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl"
                        >
                            <Flag className="w-6 h-6" />
                            Terminer
                        </button>
                    </>
                )}

                {isResults && !showResultsModal && (
                    <button
                        onClick={onShowResults}
                        className="flex items-center gap-2 px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl"
                    >
                        <Trophy className="w-6 h-6" />
                        Voir Résultats
                    </button>
                )}
            </div>
        </div>
    )
}
