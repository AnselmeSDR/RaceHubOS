import { motion } from 'framer-motion'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { positionColor } from './leaderboardOrder'

// The place, and the places won or lost since the last lap
export default function RowPosition({ position, delta, expanded }) {
  return (
    <div
      data-testid="leaderboard-position"
      className={`${expanded ? 'w-20' : 'w-12 @4xl:w-16'} flex-shrink-0 flex items-center justify-center gap-1`}
    >
      <span className={`${expanded ? 'text-3xl' : 'text-2xl'} font-black ${positionColor(position)}`}>{position}</span>
      {delta !== 0 && delta !== undefined && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          className={`flex items-center gap-0.5 text-xs font-bold ${delta > 0 ? 'text-green-500' : 'text-red-500'}`}
        >
          {delta > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
          <span>{Math.abs(delta)}</span>
        </motion.div>
      )}
    </div>
  )
}
