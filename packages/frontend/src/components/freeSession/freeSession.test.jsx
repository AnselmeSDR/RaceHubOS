import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionType } from '@racehubos/shared'
import i18n from '@/i18n'
import FreeSessionStandingsPanel from './FreeSessionStandingsPanel'
import FreeSessionToolbar from './FreeSessionToolbar'

const { received } = vi.hoisted(() => ({ received: {} }))
vi.mock('@/components/championship/StandingsTabs', () => ({
  default: (props) => {
    received.StandingsTabs = props
    return <div data-testid="StandingsTabs" />
  },
}))

const tracks = [
  { id: 't1', name: 'Monza' },
  { id: 't2', name: 'Spa-Francorchamps' },
]

function toolbar(props = {}) {
  const handlers = {
    onTrackChange: vi.fn(),
    onTypeChange: vi.fn(),
    onNewSession: vi.fn(),
    onToggleStandings: vi.fn(),
  }
  render(
    <FreeSessionToolbar
      tracks={tracks}
      trackId="t1"
      type={SessionType.PRACTICE}
      showStandings={false}
      newSessionDisabled={false}
      {...handlers}
      {...props}
    />
  )
  return handlers
}

beforeAll(() => i18n.changeLanguage('en'))
afterEach(cleanup)

describe('FreeSessionToolbar', () => {
  test('the chosen track, its full name as a tooltip', () => {
    toolbar()
    expect(screen.getByRole('combobox')).toHaveTextContent('Monza')
    expect(screen.getByRole('combobox')).toHaveAttribute('title', 'Monza')
  })

  test('a placeholder before a track is chosen', () => {
    toolbar({ trackId: null })
    expect(screen.getByRole('combobox')).toHaveTextContent('Select track...')
  })

  test('choosing another track', async () => {
    const { onTrackChange } = toolbar()
    await userEvent.click(screen.getByRole('combobox'))
    await userEvent.click(await screen.findByRole('option', { name: 'Spa-Francorchamps' }))
    expect(onTrackChange).toHaveBeenCalledWith('t2')
  })

  test('one tab per session type, the chosen one active', async () => {
    const { onTypeChange } = toolbar()
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Free Practice', 'Qualifying', 'Race'])
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(tabs[2])
    expect(onTypeChange).toHaveBeenCalledWith(SessionType.RACE)
  })

  test('a new session, unless disabled', async () => {
    const { onNewSession } = toolbar()
    await userEvent.click(screen.getByRole('button', { name: 'New session' }))
    expect(onNewSession).toHaveBeenCalledOnce()
    cleanup()
    toolbar({ newSessionDisabled: true })
    expect(screen.getByRole('button', { name: 'New session' })).toBeDisabled()
  })

  test('the standings toggle says what it does', async () => {
    const { onToggleStandings } = toolbar()
    await userEvent.click(screen.getByTitle('Show standings'))
    expect(onToggleStandings).toHaveBeenCalledOnce()
    cleanup()
    toolbar({ showStandings: true })
    expect(screen.getByTitle('Hide standings')).toHaveClass('text-primary')
  })
})

test('the standings panel shows its title and hands everything to the tabs', () => {
  const standings = { practice: [], qualif: [], race: [] }
  const onTabChange = vi.fn()
  render(
    <FreeSessionStandingsPanel
      standings={standings}
      drivers={['d']}
      activeTab={SessionType.QUALIF}
      onTabChange={onTabChange}
    />
  )
  expect(screen.getByText('Overall Standings')).toBeInTheDocument()
  expect(received.StandingsTabs).toEqual({ standings, drivers: ['d'], activeTab: SessionType.QUALIF, onTabChange })
})
