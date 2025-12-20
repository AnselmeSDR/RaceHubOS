import { TrophyIcon } from '@heroicons/react/24/outline'
import LapTime from '../LapTime'

function RecordSection({ title, colorClass, records }) {
    return (
        <div>
            <h3 className={`text-xs font-semibold uppercase mb-2 ${colorClass}`}>{title}</h3>
            {records.length === 0 ? (
                <p className="text-xs text-gray-400">Aucun record</p>
            ) : (
                <div className="space-y-2">
                    {records.map((record, idx) => (
                        <div key={record.id} className="flex items-center justify-between">
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-gray-800 truncate">
                                    {idx + 1}. {record.driver?.name}
                                </div>
                                <div className="text-xs text-gray-500 truncate">
                                    {record.car?.brand} {record.car?.model}
                                </div>
                            </div>
                            <LapTime time={record.lapTime} size="sm" />
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default function TrackRecordsPanel({ selectedTrack, trackRecords }) {
    return (
        <div className="w-80 border-l bg-white overflow-y-auto p-4">
            <div className="flex items-center gap-2 mb-4">
                <TrophyIcon className="w-5 h-5 text-yellow-500" />
                <h2 className="font-semibold text-gray-800">Records</h2>
            </div>

            {!selectedTrack ? (
                <div className="text-center text-gray-400 py-8">
                    <p>Sélectionnez un circuit</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <RecordSection
                        title="Libre"
                        colorClass="text-gray-500"
                        records={trackRecords.free}
                    />
                    <RecordSection
                        title="Qualifications"
                        colorClass="text-blue-600"
                        records={trackRecords.qualifying}
                    />
                    <RecordSection
                        title="Course"
                        colorClass="text-green-600"
                        records={trackRecords.race}
                    />
                </div>
            )}
        </div>
    )
}
