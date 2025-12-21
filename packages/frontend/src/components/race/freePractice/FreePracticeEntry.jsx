import { motion } from 'framer-motion'
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline'
import LapTime from '../LapTime'

export default function FreePracticeEntry({ entry, index }) {
    const driverColor = entry.driver?.color || 'grey'

    return (
        <motion.div
            key={entry.controller}
            layout
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{
                layout: { type: 'spring', stiffness: 200, damping: 30, mass: 1 },
                opacity: { duration: 0.3 }
            }}
            className="flex items-center gap-3 p-3 rounded-lg shadow-md"
            style={{
                background: `linear-gradient(to right, ${driverColor}45, ${driverColor}25 50%, ${driverColor}08 70%, white)`,
                borderLeft: `5px solid ${driverColor}`,
                boxShadow: `0 2px 12px ${driverColor}40`
            }}
        >
            {/* Position */}
            <div className="w-14 flex-shrink-0 text-center">
                <span className={`text-2xl font-black ${
                    index === 0 ? 'text-yellow-500' :
                        index === 1 ? 'text-gray-400' :
                            index === 2 ? 'text-orange-500' :
                                'text-gray-600'
                }`}>
                    {index + 1}
                </span>
                {/* Position delta arrow */}
                {entry.positionDelta !== 0 && entry.positionDelta !== undefined && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className={`flex items-center justify-center gap-0.5 text-xs font-bold ${
                            entry.positionDelta > 0 ? 'text-green-500' : 'text-red-500'
                        }`}
                    >
                        {entry.positionDelta > 0 ? (
                            <ArrowUpIcon className="w-3 h-3" />
                        ) : (
                            <ArrowDownIcon className="w-3 h-3" />
                        )}
                        <span>{Math.abs(entry.positionDelta)}</span>
                    </motion.div>
                )}
            </div>

            {/* Driver Photo */}
            <div
                className="w-14 h-14 rounded-lg flex items-center justify-center text-white font-black text-xl shadow-md overflow-hidden flex-shrink-0"
                style={{ backgroundColor: driverColor }}
            >
                {entry.driver?.photo ? (
                    <img
                        src={entry.driver.photo}
                        alt={entry.driver.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <span>{(entry.driver?.name || entry.controller).charAt(0)}</span>
                )}
            </div>

            {/* Number - Large NASCAR style */}
            {entry.driver?.number && (
                <div className="flex-shrink-0 w-16">
                    <span
                        className="text-5xl font-black italic opacity-20"
                        style={{ color: driverColor }}
                    >
                        {entry.driver.number}
                    </span>
                </div>
            )}

            {/* Name & Car */}
            <div className="flex-1 min-w-0">
                <div className="font-black text-xl text-gray-900 uppercase italic truncate">
                    {entry.driver?.name ? entry.driver.name.split(' ').pop() : `Ctrl ${entry.controller}`}
                </div>
                {entry.car && (
                    <div className="text-sm text-gray-500 truncate">
                        {entry.car.brand} {entry.car.model || entry.car.name || ''}
                    </div>
                )}
            </div>

            {/* Stats */}
            <div className="flex items-center gap-6 flex-shrink-0">
                <div className="text-center">
                    <div className="text-xs text-gray-400 uppercase">Tours</div>
                    <div className="font-mono font-bold text-lg text-gray-900">{entry.laps}</div>
                </div>
                <div className="text-center">
                    <div className="text-xs text-gray-400 uppercase">Meilleur</div>
                    <LapTime time={entry.bestLap} size="md" />
                </div>
                <div className="text-center">
                    <div className="text-xs text-gray-400 uppercase">Dernier</div>
                    <LapTime time={entry.lastLap} size="md" />
                </div>
            </div>
        </motion.div>
    )
}
