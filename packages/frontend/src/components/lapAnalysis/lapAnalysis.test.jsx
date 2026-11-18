import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionType } from '@racehubos/shared'
import i18n from '@/i18n'
import LapAnalysis from './LapAnalysis'

const app = { isDark: false }
vi.mock('@/context/AppContext', () => ({ useApp: () => app }))

const laps = (...times) => times.map((lapTime, i) => ({ lapNumber: i + 1, lapTime }))
const entry = (id, controller, name, color, ...times) => ({
  id,
  controller,
  driver: { name, color },
  laps: laps(...times),
})
// Ana leaves the track on her third lap; Ben is slower but clean
const ana = entry('e1', 0, 'Ana Ayrton', '#FF0000', 9000, 9200, 15000, 9100)
const ben = entry('e2', 1, 'Ben Bruno', '#0000FF', 9500, 9400, 9700)
// A race: Cid finishes 0.8 s behind Ana, Ben a lap down
const race = [
  entry('e1', 0, 'Ana Ayrton', '#FF0000', 9000, 9200, 9100, 9100),
  entry('e3', 2, 'Cid', '#00AA00', 9300, 9300, 9200, 9400),
  entry('e2', 1, 'Ben Bruno', '#0000FF', 12000, 12500, 12300),
]

const analysis = (entries, sessionType = SessionType.QUALIF) => (
  <LapAnalysis entries={entries} sessionType={sessionType} />
)
const views = () => screen.getAllByRole('radio').map((radio) => radio.textContent)
const picked = () => screen.getByRole('radio', { checked: true }).textContent
const pick = (view) => userEvent.click(screen.getByRole('radio', { name: view }))
const lines = () => screen.getAllByTestId('analysis-line').map((line) => line.dataset.driver)
const strokes = () =>
  screen.getAllByTestId('analysis-line').map((line) => line.querySelector('path').getAttribute('stroke'))
const read = () => screen.getAllByTestId('analysis-read').map((row) => row.textContent)
// The plot is 800 wide where nothing is measured, the laps spread between its margins
const hover = (clientX, clientY = 150) => fireEvent.mouseMove(screen.getByTestId('analysis-plot'), { clientX, clientY })

beforeAll(() => i18n.changeLanguage('en'))
beforeEach(() => localStorage.clear())
afterEach(cleanup)

test('nothing before a second lap, nor for balancing, which has its own chart', () => {
  const { container, rerender } = render(
    analysis([
      { ...ana, laps: laps(9000) },
      { ...ben, laps: [] },
    ])
  )
  expect(container).toBeEmptyDOMElement()
  rerender(analysis([ana, ben], SessionType.BALANCING))
  expect(container).toBeEmptyDOMElement()
  rerender(
    analysis([
      { ...ana, laps: laps(9000, 9100) },
      { ...ben, laps: [] },
    ])
  )
  expect(screen.getByTestId('lap-analysis')).toBeInTheDocument()
})

test('a race offers pace, gaps and consistency, the pace first; the gaps only mean something in a race', () => {
  const { rerender } = render(analysis(race, SessionType.RACE))
  expect(views()).toEqual(['Pace', 'Gaps', 'Consistency'])
  expect(picked()).toBe('Pace')
  expect(screen.getByText('Clean laps in seconds, rolling median of 5')).toBeInTheDocument()
  rerender(analysis(race, SessionType.PRACTICE))
  expect(views()).toEqual(['Pace', 'Consistency'])
})

test('the view picked is remembered; gaps remembered give the pace outside a race, and come back in the next one', async () => {
  const { unmount } = render(analysis(race, SessionType.RACE))
  await pick('Gaps')
  expect(screen.getByText('Gap to the leader, in seconds')).toBeInTheDocument()
  unmount()

  const qualifying = render(analysis(race, SessionType.QUALIF))
  expect(picked()).toBe('Pace')
  qualifying.unmount()

  render(analysis(race, SessionType.RACE))
  expect(picked()).toBe('Gaps')
})

test('a line per driver who lapped, in their colour; the legend hides one, never the last in sight', async () => {
  render(analysis([ana, ben, { id: 'e9', controller: 4, driver: { name: 'Zoe' }, laps: [] }]))
  expect(lines()).toEqual(['Ayrton', 'Bruno'])
  expect(strokes()).toEqual(['#FF0000', '#0000FF'])

  const [first, second] = ['Ayrton', 'Bruno'].map((name) => screen.getByRole('button', { name }))
  await userEvent.click(second)
  expect(lines()).toEqual(['Ayrton'])
  expect(second).toHaveAttribute('aria-pressed', 'false')
  await userEvent.click(first)
  expect(lines()).toEqual(['Ayrton'])
  await userEvent.click(second)
  expect(lines()).toEqual(['Ayrton', 'Bruno'])
})

test('a colour that would not read on the card is pulled away from it, in each theme', () => {
  const pale = [
    entry('e1', 0, 'Ana', '#FFFF00', 9000, 9100),
    { id: 'e2', controller: 3, driver: null, laps: laps(9500, 9400) },
  ]
  const { unmount } = render(analysis(pale))
  // Yellow darkens on the white card; a controller without a driver is grey, named by its number
  expect(strokes()[0]).not.toBe('#FFFF00')
  expect(lines()).toEqual(['Ana', '#4'])
  unmount()
  app.isDark = true
  render(analysis(pale))
  expect(strokes()[0]).toBe('#FFFF00')
  app.isDark = false
})

test('the pace: the incidents above, the fastest lap named, and a lap read gives the real times, the fastest first', () => {
  render(analysis([ana, ben]))
  expect(screen.getAllByTestId('analysis-incident')).toHaveLength(1)
  expect(screen.getByTestId('analysis-fastest')).toHaveTextContent('9.000')
  expect(screen.queryByTestId('analysis-tip')).not.toBeInTheDocument()

  // Four laps between 46 and 786: the third is at 539
  hover(540)
  expect(screen.getByTestId('analysis-tip')).toHaveTextContent('Lap 3')
  expect(read()).toEqual(['BBruno9.700', 'AAyrtonincident15.000'])
  // Ben did not drive a fourth lap
  hover(780)
  expect(screen.getByTestId('analysis-tip')).toHaveTextContent('Lap 4')
  expect(read()).toEqual(['AAyrton9.100'])

  fireEvent.mouseLeave(screen.getByTestId('analysis-plot'))
  expect(screen.queryByTestId('analysis-tip')).not.toBeInTheDocument()
})

test('the gaps: each line ends on its driver with the gap of the leaderboard, in laps for who is a lap down', async () => {
  render(analysis(race, SessionType.RACE))
  await pick('Gaps')
  expect(screen.getAllByTestId('analysis-end').map((end) => end.textContent)).toEqual([
    'AAyrton',
    'CCid+0.8',
    'BBruno+1 lap',
  ])
  expect(screen.queryByTestId('analysis-incident')).not.toBeInTheDocument()

  // Four laps between 46 and 692: the second is at 261
  hover(261)
  expect(screen.getByTestId('analysis-tip')).toHaveTextContent('Lap 2')
  expect(read()).toEqual(['AAyrtonLeader', 'CCid+0.400', 'BBruno+6.300'])
})

test('the consistency: a line per driver with its figures over the clean laps, the lowest of each column in gold', async () => {
  render(analysis([ana, ben]))
  await pick('Consistency')
  const figures = (row) =>
    ['best', 'median', 'spread', 'incidents', 'lost'].map((key) => within(row).getByTestId(`analysis-${key}`))
  const [first, second] = screen.getAllByTestId('analysis-row').map(figures)
  expect(first.map((cell) => cell.textContent)).toEqual(['9.000', '9.100', '±0.08', '1', '5.9 s'])
  expect(second.map((cell) => cell.textContent)).toEqual(['9.400', '9.500', '±0.12', '0', '0.0 s'])
  expect(first.map((cell) => cell.classList.contains('text-yellow-600'))).toEqual([true, true, true, false, false])
  expect(second.map((cell) => cell.classList.contains('text-yellow-600'))).toEqual([false, false, false, true, true])
  // Neither the legend nor the lines of the other views
  expect(screen.queryByRole('button', { name: 'Ayrton' })).not.toBeInTheDocument()
})

test('the consistency draws the clean laps only, the best apart; a lap pointed at is named with its time', async () => {
  render(analysis([ana, ben]))
  await pick('Consistency')
  const [first] = screen.getAllByTestId('analysis-row')
  // Ana: 9200 and 9100; her best has its own mark, the incident is only counted
  const dots = within(first).getAllByTestId('analysis-lap')
  expect(dots).toHaveLength(2)
  await userEvent.hover(dots[0])
  expect(screen.getByTestId('analysis-tip')).toHaveTextContent('Ayrton · lap 2 9.200')
})

test('a single driver has nobody to beat: no gold', async () => {
  render(analysis([ana]))
  await pick('Consistency')
  expect(screen.getByTestId('analysis-best')).not.toHaveClass('text-yellow-600')
})
