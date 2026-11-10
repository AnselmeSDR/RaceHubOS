import { formatGapSeconds, podiumBadge, podiumRow } from './podium'

test('gold, silver and bronze for the podium, nothing after', () => {
  expect(podiumRow(1)).toContain('yellow')
  expect(podiumRow(2)).toContain('gray')
  expect(podiumRow(4)).toBe('')
  expect(podiumBadge(3)).toContain('orange')
  expect(podiumBadge(5)).toBe('text-muted-foreground')
})

test('a gap as seconds behind', () => {
  expect(formatGapSeconds(1500)).toBe('+1.500')
  expect(formatGapSeconds(42)).toBe('+0.042')
})
