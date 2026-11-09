import { MemoryRouter } from 'react-router-dom'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionType } from '@racehubos/shared'
import i18n from '@/i18n'
import { trackColor } from '@/lib/colors'
import TrackIdentity from './TrackIdentity'
import TrackProfileActions from './TrackProfileActions'
import TrackRecord from './TrackRecord'
import TrackRecentSessions from './TrackRecentSessions'

beforeAll(() => i18n.changeLanguage('en'))

const track = {
  id: 't1',
  name: 'Monza',
  color: '#00AA00',
  img: null,
  length: 1200,
  corners: 3,
  bestLap: 9876,
  bestLapBy: 'Ayrton',
  _count: { sessions: 1 },
}

const inRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('TrackIdentity', () => {
  test('name, length, corners and sessions in the track colour', () => {
    render(<TrackIdentity track={track} />)
    const identity = screen.getByTestId('track-identity')
    expect(screen.getByRole('heading', { name: 'Monza' })).toHaveStyle({ color: '#00AA00' })
    for (const text of ['1200m', '3 corners', '1 Session']) expect(identity).toHaveTextContent(text)
    expect(identity.querySelector('svg').parentElement).toHaveStyle({ backgroundColor: '#00AA00' })
  })

  test('a picture replaces the pin', () => {
    render(<TrackIdentity track={{ ...track, img: 'https://img.test/monza.png' }} />)
    expect(screen.getByRole('img', { name: 'Monza' })).toHaveAttribute('src', 'https://img.test/monza.png')
    expect(screen.getByTestId('track-identity').querySelector('svg')).toBeNull()
  })

  test('without colour, length, corners or sessions', () => {
    const bare = { ...track, color: null, length: null, corners: null, _count: undefined }
    expect(trackColor(bare)).toBe('#9333EA')
    render(<TrackIdentity track={bare} />)
    const identity = screen.getByTestId('track-identity')
    expect(identity).toHaveTextContent('0 Sessions')
    expect(identity).not.toHaveTextContent('corner')
    expect(identity).not.toHaveTextContent('m0')
  })
})

describe('TrackProfileActions', () => {
  test('edit, reset and delete; no export for a track', async () => {
    const user = userEvent.setup()
    const handlers = { onEdit: vi.fn(), onResetStats: vi.fn(), onDelete: vi.fn() }
    render(<TrackProfileActions resetting={false} {...handlers} />)
    const [edit, reset] = within(screen.getByTestId('track-profile-actions')).getAllByRole('button')

    await user.click(edit)
    expect(handlers.onEdit).toHaveBeenCalledTimes(1)
    await user.click(reset)
    expect(handlers.onResetStats).toHaveBeenCalledTimes(1)
    await user.click(screen.getByTestId('delete-button'))
    await user.click(screen.getByTestId('delete-button'))
    expect(handlers.onDelete).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('export-button')).not.toBeInTheDocument()
  })

  test('the reset button turns and waits while stats are reset', () => {
    render(<TrackProfileActions resetting onEdit={vi.fn()} onResetStats={vi.fn()} onDelete={vi.fn()} />)
    const reset = within(screen.getByTestId('track-profile-actions')).getAllByRole('button')[1]
    expect(reset).toBeDisabled()
    expect(reset.querySelector('svg')).toHaveClass('animate-spin')
  })
})

describe('TrackRecord', () => {
  test('the record and who holds it', () => {
    render(<TrackRecord track={track} />)
    const record = screen.getByTestId('track-record')
    expect(record).toHaveTextContent('Track record')
    expect(record).toHaveTextContent('9.876')
    expect(record).toHaveTextContent('by Ayrton')
  })

  test('a record without its holder', () => {
    render(<TrackRecord track={{ ...track, bestLapBy: null }} />)
    expect(screen.getByTestId('track-record')).not.toHaveTextContent('by')
  })

  test('nothing while no lap is recorded', () => {
    const { container } = render(<TrackRecord track={{ ...track, bestLap: null }} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('TrackRecentSessions', () => {
  test('no session yet', () => {
    inRouter(<TrackRecentSessions track={{ ...track, sessions: [] }} />)
    expect(screen.getByText('No sessions')).toBeInTheDocument()
  })

  test('each session links to its page with name, drivers and date', () => {
    const createdAt = '2026-03-14T10:00:00Z'
    const sessions = [
      { id: 's1', type: SessionType.QUALIF, name: 'Saturday quali', createdAt, _count: { drivers: 4 } },
      { id: 's2', type: SessionType.RACE, name: null, createdAt },
      { id: 's3', type: null, name: 'Untyped', createdAt },
    ]
    inRouter(<TrackRecentSessions track={{ ...track, sessions }} />)
    const [first, second, third] = screen.getAllByRole('link')

    expect(first).toHaveAttribute('href', '/sessions/s1')
    expect(first).toHaveTextContent('Qualifying')
    expect(first).toHaveTextContent('Saturday quali')
    expect(first).toHaveTextContent('4 Drivers')
    expect(first).toHaveTextContent(new Date(createdAt).toLocaleDateString('en'))

    // Without a name, the session goes by its type
    expect(within(second).getAllByText('Race')).toHaveLength(2)
    expect(second).toHaveTextContent('0 Drivers')
    expect(third).toHaveTextContent('Untyped')
  })

  test('shows the last eight sessions only', () => {
    const sessions = Array.from({ length: 10 }, (_, i) => ({
      id: `s${i}`,
      type: SessionType.RACE,
      createdAt: '2026-01-01',
    }))
    inRouter(<TrackRecentSessions track={{ ...track, sessions }} />)
    expect(screen.getAllByRole('link')).toHaveLength(8)
  })
})
