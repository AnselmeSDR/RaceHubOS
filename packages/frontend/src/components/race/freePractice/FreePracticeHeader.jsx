import { SignalIcon, SignalSlashIcon, ChevronDownIcon, ClockIcon, FlagIcon } from '@heroicons/react/24/outline'
import StateChip from '../StateChip'

export default function FreePracticeHeader({
    status,
    tracks,
    selectedTrack,
    onTrackChange,
    cuConnected,
    canStartSession,
    onStartQualifying,
    onStartRace
}) {
    return (
        <div className="bg-white border-b px-6 py-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold text-gray-800">Mode Libre</h1>
                    <StateChip status={status} />
                </div>

                <div className="flex items-center gap-3">
                    {/* Track selector */}
                    <div className="relative">
                        <select
                            value={selectedTrack?.id || ''}
                            onChange={(e) => {
                                const track = tracks.find(t => t.id === e.target.value)
                                onTrackChange(track)
                            }}
                            className="appearance-none bg-gray-100 border border-gray-300 rounded-lg px-4 py-2 pr-10 font-medium text-gray-700"
                        >
                            <option value="">Sélectionner circuit...</option>
                            {tracks.map(track => (
                                <option key={track.id} value={track.id}>{track.name}</option>
                            ))}
                        </select>
                        <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                    </div>

                    {/* Session buttons */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onStartQualifying}
                            disabled={!canStartSession}
                            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                            <ClockIcon className="w-4 h-4" />
                            Qualifications
                        </button>

                        <button
                            onClick={onStartRace}
                            disabled={!canStartSession}
                            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                            <FlagIcon className="w-4 h-4" />
                            Course
                        </button>
                    </div>

                    {/* CU status */}
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                        cuConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                        {cuConnected ? <SignalIcon className="w-5 h-5" /> : <SignalSlashIcon className="w-5 h-5" />}
                        <span className="font-medium text-sm">{cuConnected ? 'CU Connecté' : 'CU Déconnecté'}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
