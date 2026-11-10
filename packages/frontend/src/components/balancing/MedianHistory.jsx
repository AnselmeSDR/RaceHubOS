import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { medianChange } from './balancingStats'

const CHANGES = {
  improved: { Icon: TrendingDown, style: 'bg-green-500/10 text-green-500' },
  degraded: { Icon: TrendingUp, style: 'bg-red-500/10 text-red-500' },
  steady: { Icon: Minus, style: 'bg-muted text-muted-foreground' },
}

/** A car's median lap per balancing session (seconds), each marked against the one before. */
export default function MedianHistory({ history }) {
  return (
    <div className="mt-2 ml-10 flex items-center gap-1.5 flex-wrap">
      {history.map(({ median }, i) => {
        const change = medianChange(median, history[i - 1]?.median)
        const { Icon, style } = CHANGES[change] || CHANGES.steady
        return (
          <div
            key={i}
            data-testid={`median-${change || 'first'}`}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono ${style}`}
          >
            {change && <Icon className="size-2.5" />}
            <span>{(median / 1000).toFixed(3)}</span>
          </div>
        )
      })}
    </div>
  )
}
