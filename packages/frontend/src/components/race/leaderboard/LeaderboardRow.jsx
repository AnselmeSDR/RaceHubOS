import { motion } from 'framer-motion'
import { useApp } from '@/context/AppContext'
import RowIdentity from './RowIdentity'
import RowPosition from './RowPosition'
import RowStats from './RowStats'
import { rowColor } from './leaderboardOrder'

const LAYOUT_TRANSITION = {
  layout: { type: 'spring', stiffness: 200, damping: 30, mass: 1 },
  opacity: { duration: 0.3 },
}

// One driver on the board, in its color; it slides to its new place when positions change.
// `ref` reaches the row: AnimatePresence measures it in popLayout mode.
export default function LeaderboardRow({ entry, sortBy, sessionStatus, expanded, ref }) {
  const { isDark } = useApp()
  const driver = entry.driver || {}
  const color = rowColor(driver.color)
  return (
    <motion.div
      ref={ref}
      data-testid="leaderboard-row"
      layout
      initial={{ opacity: 0, x: -50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 50 }}
      transition={LAYOUT_TRANSITION}
      className={`flex items-center gap-3 rounded-lg shadow-md dark:shadow-none ${expanded ? 'p-4' : 'p-3'}`}
      style={{
        background: `linear-gradient(to right, ${color}45, ${color}25 50%, ${color}08 70%, var(--card))`,
        borderLeft: `5px solid ${color}`,
        boxShadow: isDark ? 'none' : `0 2px 12px ${color}40`,
      }}
    >
      <RowPosition position={entry.position} delta={entry.positionDelta} expanded={expanded} />
      <RowIdentity driver={driver} car={entry.car || {}} color={color} expanded={expanded} />
      <RowStats entry={entry} sortBy={sortBy} sessionStatus={sessionStatus} expanded={expanded} />
    </motion.div>
  )
}
