import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionStatus } from '@racehubos/shared'
import i18n from '@/i18n'
import { routeFetch } from '@/test/helpers'
import ChampionshipBracket from '../ChampionshipBracket'
import { bracketTime } from './bracketTime'

const BRACKET_URL = '/api/championships/c1/bracket'
const ana = { id: 'd1', name: 'Ana', img: '/api/img/ana.png' }

const bracket = (overrides = {}) => ({
  participants: [{}, {}, {}],
  qualifGroups: [
    {
      sessionId: 'q1',
      label: 'Q1',
      name: 'Qualif A',
      status: SessionStatus.FINISHED,
      drivers: [
        { id: 'sd1', driver: ana, gridPos: 1, bestLapTime: 8123 },
        { id: 'sd2', driver: { name: 'Ben' }, bestLapTime: 0 },
      ],
    },
    { sessionId: 'q2', label: 'Q2', status: SessionStatus.ACTIVE, drivers: [{ driver: null }] },
  ],
  mergedRanking: [
    { driverId: 'd1', position: 1, driver: ana, bestTime: 8123 },
    { driverId: 'd4', position: 4, bestTime: 0 },
  ],
  raceGroups: [
    {
      sessionId: 'r1',
      label: 'R1',
      status: SessionStatus.FINISHED,
      drivers: [
        { id: 'a', driver: ana, finalPos: 1, totalTime: 83456 },
        { id: 'b', driver: { name: 'Dan' }, finalPos: 4, totalTime: 0 },
      ],
    },
    { sessionId: 'r2', label: 'R2', status: 'mystery', drivers: [] },
  ],
  allQualifsFinished: true,
  ...overrides,
})

const card = (label) => screen.getByText(label).closest('button')
const driverLines = (label) =>
  within(card(label))
    .getAllByTestId('bracket-driver')
    .map((line) => line.textContent)

beforeAll(() => i18n.changeLanguage('en'))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test('a time as seconds, with minutes from one on, a dash for none', () => {
  expect(bracketTime(0)).toBe('-')
  expect(bracketTime(null)).toBe('-')
  expect(bracketTime(8123)).toBe('8.123')
  expect(bracketTime(999.6)).toBe('1.000')
  expect(bracketTime(83456)).toBe('1:23.456')
})

test('qualifying groups, the merged ranking and race groups; a click opens the session', async () => {
  routeFetch({ [BRACKET_URL]: { success: true, data: bracket() } })
  const onSessionSelect = vi.fn()
  render(<ChampionshipBracket championshipId="c1" onSessionSelect={onSessionSelect} />)
  expect(screen.getByText('Loading...')).toBeInTheDocument()

  expect(await screen.findByTestId('bracket-counts')).toHaveTextContent('3 participants·2 qualifs·2 races')
  expect(within(card('Q1')).getByText('Qualif A')).toBeInTheDocument()
  expect(within(card('Q1')).getByText('Finished')).toBeInTheDocument()
  expect(driverLines('Q1')).toEqual(['1.Ana8.123', 'Ben'])
  expect(within(card('Q1')).getByRole('presentation')).toHaveAttribute('src', '/api/img/ana.png')
  expect(within(card('Q2')).getByText('Running').querySelector('svg')).toHaveClass('animate-spin')
  expect(driverLines('Q2')).toEqual(['?'])

  expect(driverLines('R1')).toEqual(['AnaP11:23.456', 'DanP4'])
  expect(within(card('R1')).getByText('P1')).toHaveClass('text-yellow-600')
  expect(within(card('R1')).getByText('P4')).toHaveClass('text-muted-foreground')
  expect(within(card('R2')).getByText('mystery')).toBeInTheDocument()
  expect(within(card('R2')).getByText('Waiting for qualifications...')).toBeInTheDocument()

  expect(screen.getByText('Qualif Ranking')).toBeInTheDocument()
  expect(screen.getAllByTestId('ranking-entry').map((entry) => entry.textContent)).toEqual(['1Ana8.123', '4?-'])

  await userEvent.click(card('R1'))
  expect(onSessionSelect).toHaveBeenCalledWith('r1')
})

test('times stay hidden until a group finishes; a hint stands for the ranking until every qualif has', async () => {
  const running = { status: SessionStatus.ACTIVE }
  const data = bracket({ allQualifsFinished: false, participants: undefined })
  data.qualifGroups[0] = { ...data.qualifGroups[0], ...running }
  data.raceGroups[0] = { ...data.raceGroups[0], ...running }
  routeFetch({ [BRACKET_URL]: { success: true, data } })
  const { container } = render(<ChampionshipBracket championshipId="c1" />)

  expect(await screen.findByText(/Ranking after/)).toBeInTheDocument()
  expect(screen.getByTestId('bracket-counts')).toHaveTextContent('0 participants')
  expect(container.querySelector('p br')).toBeInTheDocument()
  expect(screen.queryByTestId('ranking-entry')).not.toBeInTheDocument()
  expect(driverLines('Q1')).toEqual(['1.Ana', 'Ben'])
  expect(driverLines('R1')).toEqual(['Ana', 'Dan'])
  await userEvent.click(card('Q1'))
})

test('read again when a session changes; the last bracket kept if a reading fails', async () => {
  let reply = { success: true, data: bracket() }
  const fetch = routeFetch({ [BRACKET_URL]: () => reply })
  render(<ChampionshipBracket championshipId="c1" />)
  await screen.findByText('Q1')

  reply = { success: true, data: bracket({ qualifGroups: [], raceGroups: [] }) }
  await act(async () => window.dispatchEvent(new Event('championship:races_assigned')))
  expect(screen.queryByText('Q1')).not.toBeInTheDocument()
  expect(screen.getByTestId('bracket-counts')).toHaveTextContent('0 qualifs·0 races')

  reply = { success: false }
  await act(async () => window.dispatchEvent(new Event('session:finished')))
  expect(fetch).toHaveBeenCalledTimes(3)
  expect(screen.getByTestId('bracket-counts')).toHaveTextContent('3 participants')
})

test('nothing when the bracket cannot be read', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  routeFetch({ [BRACKET_URL]: new Error('offline') })
  const { container } = render(<ChampionshipBracket championshipId="c1" />)
  await act(async () => {})
  expect(container).toBeEmptyDOMElement()
  vi.restoreAllMocks()
})

test("another championship's bracket arriving late is dropped", async () => {
  let answer
  routeFetch({
    [BRACKET_URL]: () => new Promise((resolve) => (answer = resolve)),
    '/api/championships/c2/bracket': { success: true, data: bracket({ qualifGroups: [] }) },
  })
  const { rerender } = render(<ChampionshipBracket championshipId="c1" />)
  rerender(<ChampionshipBracket championshipId="c2" />)
  expect(await screen.findByTestId('bracket-counts')).toHaveTextContent('0 qualifs')
  await act(async () => answer({ success: true, data: bracket() }))
  expect(screen.getByTestId('bracket-counts')).toHaveTextContent('0 qualifs')
})
