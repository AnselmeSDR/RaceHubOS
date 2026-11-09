import { MemoryRouter } from 'react-router-dom'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { formatLevel, SessionType } from '@racehubos/shared'
import i18n from '@/i18n'
import { carColor } from '@/lib/colors'
import CarIdentity from './CarIdentity'
import CarProfileActions from './CarProfileActions'
import CarRecentSessions from './CarRecentSessions'
import CarSpecsCard from './CarSpecsCard'

beforeAll(() => i18n.changeLanguage('en'))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const car = {
  id: 'c1',
  brand: 'Porsche',
  model: '911',
  year: 1973,
  color: '#FF0000',
  img: null,
  maxSpeed: 80,
  brakeForce: 50,
  fuelCapacity: 100,
  bestLap: 4321,
  _count: { sessions: 2 },
}

const inRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('CarIdentity', () => {
  test('name, year, settings, sessions and record in the car colour', () => {
    render(<CarIdentity car={car} />)
    const identity = screen.getByTestId('car-identity')
    expect(screen.getByRole('heading', { name: 'Porsche 911' })).toHaveStyle({ color: '#FF0000' })
    for (const text of ['1973', formatLevel(80), formatLevel(50), formatLevel(100), '2 Sessions', 'Record', '4.321']) {
      expect(identity).toHaveTextContent(text)
    }
    expect(within(identity).getByText('P')).toHaveStyle({ backgroundColor: '#FF0000' })
  })

  test('a picture replaces the initial', () => {
    render(<CarIdentity car={{ ...car, img: 'https://img.test/911.png' }} />)
    expect(screen.getByRole('img', { name: 'Porsche 911' })).toHaveAttribute('src', 'https://img.test/911.png')
    expect(screen.queryByText('P')).not.toBeInTheDocument()
  })

  test('without colour, year, record or sessions', () => {
    const bare = { ...car, color: null, year: null, bestLap: null, _count: undefined }
    expect(carColor(bare)).toBe('#22C55E')
    render(<CarIdentity car={bare} />)
    const identity = screen.getByTestId('car-identity')
    expect(identity).toHaveTextContent('0 Sessions')
    expect(identity).not.toHaveTextContent('Record')
    expect(identity).not.toHaveTextContent('1973')
  })
})

describe('CarProfileActions', () => {
  test('each button calls its handler', async () => {
    const user = userEvent.setup()
    const handlers = { onEdit: vi.fn(), onResetStats: vi.fn(), onDelete: vi.fn() }
    render(<CarProfileActions car={car} resetting={false} {...handlers} />)
    const [edit, reset] = within(screen.getByTestId('car-profile-actions')).getAllByRole('button')

    await user.click(edit)
    expect(handlers.onEdit).toHaveBeenCalledTimes(1)
    await user.click(reset)
    expect(handlers.onResetStats).toHaveBeenCalledTimes(1)
    await user.click(screen.getByTestId('delete-button'))
    await user.click(screen.getByTestId('delete-button'))
    expect(handlers.onDelete).toHaveBeenCalledTimes(1)
  })

  test('exports this car', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 500 }))
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<CarProfileActions car={car} resetting={false} onEdit={vi.fn()} onResetStats={vi.fn()} onDelete={vi.fn()} />)
    await userEvent.click(screen.getByTestId('export-button'))
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/cars\/c1\/export$/))
  })

  test('the reset button turns and waits while stats are reset', () => {
    render(<CarProfileActions car={car} resetting onEdit={vi.fn()} onResetStats={vi.fn()} onDelete={vi.fn()} />)
    const reset = within(screen.getByTestId('car-profile-actions')).getAllByRole('button')[1]
    expect(reset).toBeDisabled()
    expect(reset.querySelector('svg')).toHaveClass('animate-spin')
  })
})

describe('CarRecentSessions', () => {
  test('no session yet', () => {
    inRouter(<CarRecentSessions car={{ ...car, sessions: [] }} />)
    expect(screen.getByText('No sessions')).toBeInTheDocument()
  })

  test('each session links to its page with track, position and best lap', () => {
    const sessions = [
      {
        id: 'sd1',
        session: { id: 's1', type: SessionType.RACE, track: { name: 'Monza' } },
        finalPos: 1,
        bestLapTime: 12345,
      },
      { id: 'sd2', sessionId: 's2', session: null, finalPos: null, bestLapTime: null },
      { id: 'sd3', session: { id: 's3', type: 'endurance', track: null } },
    ]
    inRouter(<CarRecentSessions car={{ ...car, sessions }} />)
    const [first, second, third] = screen.getAllByRole('link')

    expect(first).toHaveAttribute('href', '/sessions/s1')
    expect(first).toHaveTextContent('Race')
    expect(first).toHaveTextContent('Monza')
    expect(first).toHaveTextContent('12.345')
    expect(within(first).getByText('P1')).toHaveStyle({ color: '#FF0000' })

    expect(second).toHaveAttribute('href', '/sessions/s2')
    expect(second).toHaveTextContent('Unknown track')
    expect(second).not.toHaveTextContent('P')

    // A type the glossary does not know is shown as is
    expect(third).toHaveTextContent('endurance')
  })

  test('shows the last eight sessions only', () => {
    const sessions = Array.from({ length: 10 }, (_, i) => ({ id: `sd${i}`, sessionId: `s${i}` }))
    inRouter(<CarRecentSessions car={{ ...car, sessions }} />)
    expect(screen.getAllByRole('link')).toHaveLength(8)
  })
})

describe('CarSpecsCard', () => {
  test('only the filled specs, grouped, with the notes', () => {
    render(
      <CarSpecsCard
        car={{ ...car, motor: 'Sport', chassis: '', weightGrams: 85, lengthMm: null, notes: 'Magnet\nreplaced' }}
      />
    )
    const specs = screen.getByTestId('car-specs')
    expect(screen.getByTestId('car-spec-motor')).toHaveTextContent('Sport')
    expect(screen.getByTestId('car-spec-weightGrams')).toHaveTextContent('85')
    expect(screen.queryByTestId('car-spec-chassis')).not.toBeInTheDocument()
    expect(screen.queryByTestId('car-spec-lengthMm')).not.toBeInTheDocument()
    for (const text of ['Equipment', 'Measurements', 'Notes', 'Magnet']) expect(specs).toHaveTextContent(text)
    expect(specs).not.toHaveTextContent('No specification')
  })

  test('a car nobody documented says how to fill it in', () => {
    render(<CarSpecsCard car={car} />)
    const specs = screen.getByTestId('car-specs')
    expect(specs).toHaveTextContent('No specification filled in yet')
    expect(specs).not.toHaveTextContent('Equipment')
  })
})
