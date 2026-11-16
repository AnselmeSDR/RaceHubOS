import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionStatus } from '@racehubos/shared'
import i18n from '@/i18n'
import { routeFetch } from '@/test/helpers'
import ChampionshipBracket from '../ChampionshipBracket'
import { bracketTime } from './bracketTime'

const BRACKET_URL = '/api/championships/c1/bracket'
const ana = { id: 'd1', name: 'Ana', img: '/api/img/ana.png' }
const ben = { id: 'd2', name: 'Ben', img: '/api/img/ben.png' }
const dan = { id: 'd3', name: 'Dan', img: '/api/img/dan.png' }
const eve = { id: 'd4', name: 'Eve', img: '/api/img/eve.png' }
const zoe = { id: 'd5', name: 'Zoe', img: '/api/img/zoe.png' }
const entry = (driver, fields) => ({ id: `${driver.id}-entry`, driverId: driver.id, driver, ...fields })
const { FINISHED, ACTIVE, DRAFT } = SessionStatus

// Every qualif over: ranked, R1 run, R2 running
const bracket = (overrides = {}) => ({
  participants: [ana, ben, dan, eve].map((driver) => ({ driverId: driver.id, driver })),
  qualifGroups: [
    { sessionId: 'q1', label: 'Q1', status: FINISHED, drivers: [entry(ana, { bestLapTime: 8123 }), entry(ben, {})] },
    {
      sessionId: 'q2',
      label: 'Q2',
      status: FINISHED,
      drivers: [entry(dan, { bestLapTime: 8500 }), entry(eve, { bestLapTime: 9000 })],
    },
  ],
  mergedRanking: [ana, dan, eve, ben].map((driver, i) => ({ driverId: driver.id, driver, position: i + 1 })),
  raceGroups: [
    {
      sessionId: 'r1',
      label: 'R1',
      status: FINISHED,
      drivers: [entry(ana, { finalPos: 2 }), entry(dan, { finalPos: 1 })],
    },
    { sessionId: 'r2', label: 'R2', status: ACTIVE, drivers: [entry(eve, {}), entry(ben, {})] },
  ],
  allQualifsFinished: true,
  ...overrides,
})

const rows = () => screen.getAllByRole('row').filter((row) => within(row).queryAllByRole('cell').length)
const lines = () =>
  rows().map((row) =>
    within(row)
      .getAllByRole('cell')
      .map((cell) => cell.textContent)
  )
const rowOf = (name) => rows().find((row) => row.textContent.startsWith(name))

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

test('one line per driver by rank: qualif and best lap, rank, race and place; a session clicked opens', async () => {
  routeFetch({ [BRACKET_URL]: { success: true, data: bracket() } })
  const onSessionSelect = vi.fn()
  render(<ChampionshipBracket championshipId="c1" onSessionSelect={onSessionSelect} />)
  expect(screen.getByText('Loading...')).toBeInTheDocument()

  expect(await screen.findAllByRole('columnheader')).not.toHaveLength(0)
  expect(lines()).toEqual([
    ['Ana', 'Q18.123', '1', 'R1P2'],
    ['Dan', 'Q28.500', '2', 'R1P1'],
    ['Eve', 'Q29.000', '3', 'R2'],
    ['Ben', 'Q1', '4', 'R2'],
  ])
  expect(within(rowOf('Ana')).getByRole('presentation')).toHaveAttribute('src', '/api/img/ana.png')
  expect(within(rowOf('Eve')).getByText('3')).toHaveClass('text-yellow-600')
  expect(within(rowOf('Ben')).getByText('4')).toHaveClass('text-muted-foreground')
  expect(within(rowOf('Dan')).getByText('P1')).toHaveClass('text-yellow-600')

  // The status dot of the session tabs: grey once over, pulsing while running
  const [r2] = within(rowOf('Eve')).getAllByRole('button', { name: 'R2' })
  expect(r2).toHaveAttribute('title', 'Running')
  expect(r2.querySelector('span')).toHaveClass('animate-pulse')

  await userEvent.click(within(rowOf('Ana')).getByRole('button', { name: 'R1' }))
  expect(onSessionSelect).toHaveBeenCalledWith('r1')
})

test('until every qualif is over: in qualifying order, no rank, a time once its group is over, no race yet', async () => {
  const data = bracket({
    participants: [zoe, ana, ben, dan, eve].map((driver) => ({ driverId: driver.id, driver })),
    mergedRanking: [],
    allQualifsFinished: false,
    raceGroups: [{ sessionId: 'r1', label: 'R1', status: DRAFT, drivers: [] }],
  })
  data.qualifGroups[1] = { ...data.qualifGroups[1], status: ACTIVE }
  routeFetch({ [BRACKET_URL]: { success: true, data } })
  render(<ChampionshipBracket championshipId="c1" />)

  await screen.findAllByRole('columnheader')
  expect(lines()).toEqual([
    ['Ana', 'Q18.123', '', ''],
    ['Ben', 'Q1', '', ''],
    ['Dan', 'Q2', '', ''],
    ['Eve', 'Q2', '', ''],
    ['Zoe', '', '', ''],
  ])
  expect(within(rowOf('Ana')).getByRole('button', { name: 'Q1' })).toHaveAttribute('title', 'Finished')
})

test('read again when a session changes; the last bracket kept if a reading fails', async () => {
  let reply = { success: true, data: bracket() }
  const fetch = routeFetch({ [BRACKET_URL]: () => reply })
  render(<ChampionshipBracket championshipId="c1" />)
  await screen.findAllByRole('columnheader')

  reply = { success: true, data: bracket({ qualifGroups: [], raceGroups: [], mergedRanking: [] }) }
  await act(async () => window.dispatchEvent(new Event('championship:races_assigned')))
  expect(lines()).toEqual(['Ana', 'Ben', 'Dan', 'Eve'].map((name) => [name, '', '', '']))

  reply = { success: false }
  await act(async () => window.dispatchEvent(new Event('session:finished')))
  expect(fetch).toHaveBeenCalledTimes(3)
  expect(lines()).toHaveLength(4)
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
    '/api/championships/c2/bracket': { success: true, data: bracket({ qualifGroups: [], mergedRanking: [] }) },
  })
  const { rerender } = render(<ChampionshipBracket championshipId="c1" />)
  rerender(<ChampionshipBracket championshipId="c2" />)
  await screen.findAllByRole('columnheader')
  await act(async () => answer({ success: true, data: bracket() }))
  expect(screen.queryByRole('button', { name: 'Q1' })).not.toBeInTheDocument()
})
