import { useTranslation } from 'react-i18next'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { chartRows, medianOf } from './balancingStats'

/** Each car's lap times (seconds) along the session, its median as a dashed line. */
export default function BalancingLapChart({ series }) {
  const { t } = useTranslation('balancing')
  const nameOf = (key) => series.find((s) => s.key === key)?.name || key

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{t('chart.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartRows(series)} margin={{ top: 5, right: 20, bottom: 25, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="lap"
              label={{ value: t('chart.axisLap'), position: 'insideBottomRight', offset: -5 }}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              domain={['auto', 'auto']}
              label={{ value: t('chart.axisTime'), angle: -90, position: 'insideLeft', offset: 5 }}
              tick={{ fontSize: 12 }}
              tickFormatter={(v) => v.toFixed(1)}
            />
            <Tooltip
              formatter={(value, key) => [t('chart.tooltipValue', { value: value.toFixed(3) }), nameOf(key)]}
              labelFormatter={(lap) => t('chart.tooltipLapLabel', { lap })}
            />
            <Legend formatter={nameOf} />
            {series.map(({ key, color }) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={color}
                strokeWidth={2}
                dot={{ r: 3, fill: color }}
                activeDot={{ r: 5 }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
            {series.map(({ key, color, laps }) => {
              const median = medianOf(laps.map((lap) => lap.lapTime / 1000))
              if (!median) return null
              return (
                <ReferenceLine
                  key={`median-${key}`}
                  y={median}
                  stroke={color}
                  strokeDasharray="5 5"
                  strokeOpacity={0.5}
                />
              )
            })}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
