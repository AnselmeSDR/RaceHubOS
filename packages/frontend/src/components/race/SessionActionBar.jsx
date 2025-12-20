import { ClockIcon, FlagIcon } from '@heroicons/react/24/outline'

export default function SessionActionBar({
    canStartSession,
    selectedTrack,
    cuConnected,
    configuredCount,
    onStartQualifying,
    onStartRace
}) {
    return (
        <div className="bg-white border-t px-6 py-4">
            <div className="flex items-center justify-end gap-4">
                <button
                    onClick={onStartQualifying}
                    disabled={!canStartSession}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <ClockIcon className="w-5 h-5" />
                    Qualifications
                </button>

                <button
                    onClick={onStartRace}
                    disabled={!canStartSession}
                    className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <FlagIcon className="w-5 h-5" />
                    Course
                </button>
            </div>

            {!canStartSession && (
                <p className="text-center text-sm text-gray-500 mt-2">
                    {!selectedTrack && 'Sélectionnez un circuit. '}
                    {!cuConnected && 'Control Unit non connecté. '}
                    {configuredCount === 0 && 'Configurez au moins un controller. '}
                </p>
            )}
        </div>
    )
}
