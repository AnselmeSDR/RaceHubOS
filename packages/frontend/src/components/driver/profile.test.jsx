import { MemoryRouter } from 'react-router-dom'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionType } from '@racehubos/shared'
import i18n from '@/i18n'
import { driverColor } from '@/lib/colors'
import DriverIdentity from './DriverIdentity'
import DriverProfileActions from './DriverProfileActions'
import DriverRecentSessions from './DriverRecentSessions'

beforeAll(() => i18n.changeLanguage('en'))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const driver = {
  id: 'd1',
  name: 'Ayrton',
  color: '#FFCC00',
  img: null,
  number: 12,
  divisions: [
    { id: 'dv1', name: 'BRONZE', color: '#945434', scope: 'driver' },
    { id: 'dv2', name: 'Guests', shortName: 'INV', color: '#424242', scope: 'driver' },
  ],
  races: 4,
  wins: 3,
  podiums: 5,
  bestLap: 7654,
  _count: { sessions: 6, laps: 120 },
}

const inRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('DriverIdentity', () => {
  test('name in the text colour, number, divisions and figures; races are not sessions', () => {
    render(<DriverIdentity driver={driver} />)
    const identity = screen.getByTestId('driver-identity')
    // The driver's colour is their picture's, not their name's: a dark one would not read
    expect(screen.getByRole('heading', { name: 'Ayrton' })).not.toHaveAttribute('style')
    for (const text of ['#12', '4 Races', '3 Wins', '5 Podiums', '120 Laps', 'Record', '7.654']) {
      expect(identity).toHaveTextContent(text)
    }
    expect(within(identity).getByText('A').parentElement).toHaveStyle({ backgroundColor: '#FFCC00' })
    // Each division by its short name, white on a dark colour
    const badges = screen.getAllByTestId('division-badge')
    expect(badges.map((b) => b.textContent)).toEqual(['BRONZE', 'INV'])
    expect(badges[0]).toHaveStyle({ backgroundColor: '#945434', color: '#fff' })
    expect(badges[1]).toHaveAttribute('title', 'Guests')
  })

  test('a picture replaces the initial', () => {
    render(<DriverIdentity driver={{ ...driver, img: 'https://img.test/ayrton.png' }} />)
    expect(screen.getByRole('img', { name: 'Ayrton' })).toHaveAttribute('src', 'https://img.test/ayrton.png')
    expect(screen.queryByText('A')).not.toBeInTheDocument()
  })

  test('without colour, number, division, record or figures', () => {
    const bare = {
      ...driver,
      color: null,
      number: null,
      divisions: [],
      bestLap: null,
      races: 0,
      wins: 0,
      podiums: null,
    }
    expect(driverColor(bare)).toBe('#3B82F6')
    render(<DriverIdentity driver={{ ...bare, _count: undefined }} />)
    const identity = screen.getByTestId('driver-identity')
    for (const text of ['0 Races', '0 Wins', '0 Podiums', '0 Laps']) expect(identity).toHaveTextContent(text)
    expect(identity).not.toHaveTextContent('#')
    expect(identity).not.toHaveTextContent('Record')
    expect(screen.queryByTestId('division-badge')).not.toBeInTheDocument()
  })
})

describe('DriverProfileActions', () => {
  test('each button calls its handler', async () => {
    const user = userEvent.setup()
    const handlers = { onEdit: vi.fn(), onResetStats: vi.fn(), onDelete: vi.fn() }
    render(<DriverProfileActions driver={driver} resetting={false} {...handlers} />)
    const [edit, reset] = within(screen.getByTestId('driver-profile-actions')).getAllByRole('button')

    await user.click(edit)
    expect(handlers.onEdit).toHaveBeenCalledTimes(1)
    await user.click(reset)
    expect(handlers.onResetStats).toHaveBeenCalledTimes(1)
    await user.click(screen.getByTestId('delete-button'))
    await user.click(screen.getByTestId('delete-button'))
    expect(handlers.onDelete).toHaveBeenCalledTimes(1)
  })

  test('exports this driver', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 500 }))
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <DriverProfileActions
        driver={driver}
        resetting={false}
        onEdit={vi.fn()}
        onResetStats={vi.fn()}
        onDelete={vi.fn()}
      />
    )
    await userEvent.click(screen.getByTestId('export-button'))
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/drivers\/d1\/export$/))
  })

  test('the reset button turns and waits while stats are reset', () => {
    render(
      <DriverProfileActions driver={driver} resetting onEdit={vi.fn()} onResetStats={vi.fn()} onDelete={vi.fn()} />
    )
    const reset = within(screen.getByTestId('driver-profile-actions')).getAllByRole('button')[1]
    expect(reset).toBeDisabled()
    expect(reset.querySelector('svg')).toHaveClass('animate-spin')
  })
})

describe('DriverRecentSessions', () => {
  test('no session yet', () => {
    inRouter(<DriverRecentSessions driver={{ ...driver, sessions: [] }} />)
    expect(screen.getByText('No sessions')).toBeInTheDocument()
  })

  test('each session links to its page: date, kind, name, track, place and best lap, each in its column', () => {
    const startedAt = '2026-03-14T10:00:00Z'
    const sessions = [
      {
        id: 'sd1',
        session: { id: 's1', name: 'Sunday race', type: SessionType.RACE, track: { name: 'Monza' }, startedAt },
        finalPos: 2,
        bestLapTime: 61234,
      },
      { id: 'sd2', sessionId: 's2', session: null },
    ]
    inRouter(<DriverRecentSessions driver={{ ...driver, sessions }} />)
    expect([...screen.getByTestId('columns').children].map((th) => th.textContent)).toEqual([
      'Date',
      'Type',
      'Session',
      'Track',
      'Pos.',
      'Best',
    ])
    const [first, second] = screen.getAllByRole('link')

    expect(first).toHaveAttribute('href', '/sessions/s1')
    const day = new Date(startedAt).toLocaleDateString('en', { day: 'numeric', month: 'short', year: '2-digit' })
    expect([...first.children].map((cell) => cell.textContent)).toEqual([
      day,
      'Race',
      'Sunday race',
      'Monza',
      'P2',
      '1:01.234',
    ])
    // The place reads from the podium colours, not from the driver's
    expect(within(first).getByText('P2')).toHaveClass('text-gray-400')
    expect(second).toHaveAttribute('href', '/sessions/s2')
    // A session not run yet keeps its cells empty
    expect([...second.children].map((cell) => cell.textContent)).toEqual(['', '', '', 'Unknown track', '', ''])
  })

  test('shows the last eight sessions only', () => {
    const sessions = Array.from({ length: 10 }, (_, i) => ({ id: `sd${i}`, sessionId: `s${i}` }))
    inRouter(<DriverRecentSessions driver={{ ...driver, sessions }} />)
    expect(screen.getAllByRole('link')).toHaveLength(8)
  })
})
