import { Trophy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import LapTime from '../LapTime'

function RecordSection({ title, colorClass, records = [] }) {
    const { t } = useTranslation('race')

    return (
        <div>
            <h3 className={`text-xs font-semibold uppercase mb-2 ${colorClass}`}>{title}</h3>
            {records.length === 0 ? (
                <p className="text-xs text-gray-400">{t('trackRecords.noRecord')}</p>
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

export default function TrackRecordsPanel({ selectedTrack, trackRecords = {} }) {
    const { t } = useTranslation('race')

    return (
        <div className="w-80 border-l bg-white overflow-y-auto p-4">
            <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5 text-yellow-500" />
                <h2 className="font-semibold text-gray-800">{t('trackRecords.title')}</h2>
            </div>

            {!selectedTrack ? (
                <div className="text-center text-gray-400 py-8">
                    <p>{t('trackRecords.selectTrack')}</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <RecordSection
                        title={t('trackRecords.practice')}
                        colorClass="text-gray-500"
                        records={trackRecords.practice}
                    />
                    <RecordSection
                        title={t('trackRecords.qualif')}
                        colorClass="text-blue-600"
                        records={trackRecords.qualif}
                    />
                    <RecordSection
                        title={t('trackRecords.race')}
                        colorClass="text-green-600"
                        records={trackRecords.race}
                    />
                </div>
            )}
        </div>
    )
}
