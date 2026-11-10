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
  team: { name: 'McLaren', color: '#FF8000' },
  wins: 3,
  podiums: 5,
  bestLap: 7654,
  _count: { sessions: 6, laps: 120 },
}

const inRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('DriverIdentity', () => {
  test('name, number, team and figures in the driver colour', () => {
    render(<DriverIdentity driver={driver} />)
    const identity = screen.getByTestId('driver-identity')
    expect(screen.getByRole('heading', { name: 'Ayrton' })).toHaveStyle({ color: '#FFCC00' })
    for (const text of ['#12', '6 Races', '3 Wins', '5 Podiums', '120 Laps', 'Record', '7.654']) {
      expect(identity).toHaveTextContent(text)
    }
    expect(within(identity).getByText('A').parentElement).toHaveStyle({ backgroundColor: '#FFCC00' })
    expect(screen.getByTestId('driver-team-badge')).toHaveTextContent('McLaren')
    expect(screen.getByTestId('driver-team-badge')).toHaveStyle({ color: '#FF8000' })
  })

  test('a picture replaces the initial', () => {
    render(<DriverIdentity driver={{ ...driver, img: 'https://img.test/ayrton.png' }} />)
    expect(screen.getByRole('img', { name: 'Ayrton' })).toHaveAttribute('src', 'https://img.test/ayrton.png')
    expect(screen.queryByText('A')).not.toBeInTheDocument()
  })

  test('a team without colour takes the driver colour', () => {
    render(<DriverIdentity driver={{ ...driver, team: { name: 'Privateer', color: null } }} />)
    expect(screen.getByTestId('driver-team-badge')).toHaveStyle({ color: '#FFCC00' })
  })

  test('without colour, number, team, record or figures', () => {
    const bare = { ...driver, color: null, number: null, team: null, bestLap: null, wins: 0, podiums: null }
    expect(driverColor(bare)).toBe('#3B82F6')
    render(<DriverIdentity driver={{ ...bare, _count: undefined }} />)
    const identity = screen.getByTestId('driver-identity')
    for (const text of ['0 Races', '0 Wins', '0 Podiums', '0 Laps']) expect(identity).toHaveTextContent(text)
    expect(identity).not.toHaveTextContent('#')
    expect(identity).not.toHaveTextContent('Record')
    expect(screen.queryByTestId('driver-team-badge')).not.toBeInTheDocument()
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

  test('each session links to its page with track, position and best lap', () => {
    const sessions = [
      {
        id: 'sd1',
        session: { id: 's1', type: SessionType.RACE, track: { name: 'Monza' } },
        finalPos: 2,
        bestLapTime: 61234,
      },
      { id: 'sd2', sessionId: 's2', session: null },
    ]
    inRouter(<DriverRecentSessions driver={{ ...driver, sessions }} />)
    const [first, second] = screen.getAllByRole('link')

    expect(first).toHaveAttribute('href', '/sessions/s1')
    for (const text of ['Race', 'Monza', '1:01.234']) expect(first).toHaveTextContent(text)
    expect(within(first).getByText('P2')).toHaveStyle({ color: '#FFCC00' })
    expect(second).toHaveAttribute('href', '/sessions/s2')
    expect(second).toHaveTextContent('Unknown track')
  })

  test('shows the last eight sessions only', () => {
    const sessions = Array.from({ length: 10 }, (_, i) => ({ id: `sd${i}`, sessionId: `s${i}` }))
    inRouter(<DriverRecentSessions driver={{ ...driver, sessions }} />)
    expect(screen.getAllByRole('link')).toHaveLength(8)
  })
})
