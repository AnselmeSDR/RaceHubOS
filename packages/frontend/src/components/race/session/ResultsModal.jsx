import { Trophy, RefreshCw } from 'lucide-react'
import LapTime from '../LapTime'

export default function ResultsModal({
    sessionName,
    sessionTypeLabel,
    leaderboard,
    onDismiss
}) {
    const podiumEntries = leaderboard.slice(0, 3)

    return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-gray-800 rounded-xl max-w-2xl w-full border border-gray-700 my-8">
                <div className="p-6 border-b border-gray-700 text-center">
                    <Trophy className="w-12 h-12 text-yellow-400 mx-auto mb-2" />
                    <h2 className="text-2xl font-bold text-white">Résultats</h2>
                    <p className="text-gray-400">{sessionName || sessionTypeLabel}</p>
                </div>

                {/* Podium */}
                {podiumEntries.length > 0 && (
                    <div className="p-6 border-b border-gray-700">
                        <div className="flex items-end justify-center gap-4">
                            {/* 2nd */}
                            {podiumEntries[1] && (
                                <div className="text-center">
                                    <div className="w-16 h-16 rounded-full bg-gray-400 flex items-center justify-center text-white font-bold text-xl mx-auto mb-2">
                                        {podiumEntries[1].driver?.name?.charAt(0) || '2'}
                                    </div>
                                    <div className="bg-gray-400 text-gray-900 w-20 h-16 rounded-t-lg flex items-center justify-center text-2xl font-bold">2</div>
                                    <p className="text-white text-sm mt-2 truncate max-w-[80px]">{podiumEntries[1].driver?.name}</p>
                                </div>
                            )}
                            {/* 1st */}
                            {podiumEntries[0] && (
                                <div className="text-center -mt-4">
                                    <div className="w-20 h-20 rounded-full bg-yellow-400 flex items-center justify-center text-yellow-900 font-bold text-2xl mx-auto mb-2">
                                        {podiumEntries[0].driver?.name?.charAt(0) || '1'}
                                    </div>
                                    <div className="bg-yellow-400 text-yellow-900 w-24 h-20 rounded-t-lg flex items-center justify-center text-3xl font-bold">1</div>
                                    <p className="text-white font-bold mt-2 truncate max-w-[100px]">{podiumEntries[0].driver?.name}</p>
                                </div>
                            )}
                            {/* 3rd */}
                            {podiumEntries[2] && (
                                <div className="text-center">
                                    <div className="w-16 h-16 rounded-full bg-orange-400 flex items-center justify-center text-white font-bold text-xl mx-auto mb-2">
                                        {podiumEntries[2].driver?.name?.charAt(0) || '3'}
                                    </div>
                                    <div className="bg-orange-400 text-orange-900 w-20 h-12 rounded-t-lg flex items-center justify-center text-2xl font-bold">3</div>
                                    <p className="text-white text-sm mt-2 truncate max-w-[80px]">{podiumEntries[2].driver?.name}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Full results */}
                <div className="p-6 max-h-60 overflow-y-auto">
                    <table className="w-full">
                        <thead>
                        <tr className="text-gray-400 text-xs uppercase">
                            <th className="text-left py-2">Pos</th>
                            <th className="text-left py-2">Pilote</th>
                            <th className="text-center py-2">Tours</th>
                            <th className="text-right py-2">Meilleur</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                        {leaderboard.map((entry, idx) => (
                            <tr key={idx} className="text-white">
                                <td className="py-2 font-bold">{entry.position || idx + 1}</td>
                                <td className="py-2">{entry.driver?.name || 'Unknown'}</td>
                                <td className="py-2 text-center">{entry.laps ?? entry.lapCount ?? 0}</td>
                                <td className="py-2 text-right">
                                    <LapTime time={entry.bestLap} size="sm" />
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>

                <div className="p-6 border-t border-gray-700">
                    <button
                        onClick={onDismiss}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl"
                    >
                        <RefreshCw className="w-5 h-5" />
                        Retour au mode libre
                    </button>
                </div>
            </div>
        </div>
    )
}
