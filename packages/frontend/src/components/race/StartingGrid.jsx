import { Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { DriverGridPosition } from '../DriverDisplays'

/**
 * StartingGrid - Grille de départ style NASCAR
 * 2 pilotes par rangée, disposition en quinconce
 */
export default function StartingGrid({ entries = [] }) {
  // Sort by gridPos, fallback to controller order
  const sortedEntries = [...entries].sort((a, b) => {
    const gridA = a.gridPos ?? a.controller ?? 999
    const gridB = b.gridPos ?? b.controller ?? 999
    return gridA - gridB
  })

  if (!entries || entries.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Users className="size-10 mb-3 opacity-30" />
          <p className="font-medium">Aucun pilote sur la grille</p>
          <p className="text-xs mt-1">Configurez les pilotes pour démarrer</p>
        </CardContent>
      </Card>
    )
  }

  // Group entries into rows of 2
  const rows = []
  for (let i = 0; i < sortedEntries.length; i += 2) {
    rows.push(sortedEntries.slice(i, i + 2))
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/15 text-yellow-600 rounded-lg font-semibold text-sm">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
          </svg>
          Grille de départ
        </span>
      </div>

      {/* Grid rows */}
      <div className="space-y-3">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex}>
            {/* Row label */}
            <div className="text-xs font-bold text-muted-foreground/50 uppercase tracking-wider mb-2 pl-1">
              RANG {rowIndex + 1}
            </div>

            {/* 2 drivers per row, staggered */}
            <div className="grid grid-cols-2 gap-4">
              {row.map((entry, posInRow) => {
                const driver = entry.driver || {}
                const car = entry.car || {}

                // Build driver object for DriverGridPosition
                const driverData = {
                  name: driver.name || 'Unknown',
                  number: driver.number,
                  color: driver.color || car.color || '#3B82F6',
                  img: driver.img,
                  team: car.brand ? { name: `${car.brand} ${car.model || ''}` } : null
                }

                return (
                  <div
                    key={entry.id || `ctrl-${entry.controller}`}
                    className={posInRow === 1 ? 'mt-6' : ''}
                  >
                    <DriverGridPosition
                      driver={driverData}
                      side={posInRow === 0 ? 'left' : 'right'}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
