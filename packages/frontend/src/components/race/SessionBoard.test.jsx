import { cleanup, render, screen } from '@testing-library/react'
import { SessionStatus, SessionType } from '@racehubos/shared'
import SessionBoard from './SessionBoard'

const { received, spy } = vi.hoisted(() => {
  const received = {}
  const spy = (name) => ({
    default: (props) => {
      received[name] = props
      return <div data-testid={name} />
    },
  })
  return { received, spy }
})
vi.mock('@/components/race/SessionLeaderboard', () => spy('SessionLeaderboard'))
vi.mock('@/components/race/StartingGrid', () => spy('StartingGrid'))

const entries = [{ id: 'e1' }]

afterEach(cleanup)

test('nothing without a session', () => {
  const { container } = render(<SessionBoard session={null} entries={[]} maxLaps={0} />)
  expect(container).toBeEmptyDOMElement()
})

test('the starting grid before the first lap', () => {
  render(<SessionBoard session={{ status: SessionStatus.READY }} entries={entries} maxLaps={0} />)
  expect(received.StartingGrid).toEqual({ entries })
  expect(screen.queryByTestId('SessionLeaderboard')).not.toBeInTheDocument()
})

test('the leaderboard of a finished session, even without laps', () => {
  const session = { type: SessionType.RACE, status: SessionStatus.FINISHED }
  render(<SessionBoard session={session} entries={entries} maxLaps={0} expanded practiceSortBy="laps" />)
  expect(received.SessionLeaderboard).toEqual({
    entries,
    expanded: true,
    sortBy: 'race',
    onSortChange: undefined,
    sessionType: SessionType.RACE,
    sessionStatus: SessionStatus.FINISHED,
  })
})

test('qualifying sorts by best lap', () => {
  const session = { type: SessionType.QUALIF, status: SessionStatus.ACTIVE }
  render(<SessionBoard session={session} entries={entries} maxLaps={2} expanded={false} practiceSortBy="laps" />)
  expect(received.SessionLeaderboard).toMatchObject({ sortBy: 'bestLap', expanded: false, onSortChange: undefined })
})

test('practice sorts as the page chose, and tells it the new choice', () => {
  const onPracticeSortChange = vi.fn()
  const session = { type: SessionType.PRACTICE, status: SessionStatus.ACTIVE }
  render(
    <SessionBoard
      session={session}
      entries={entries}
      maxLaps={3}
      practiceSortBy="bestLap"
      onPracticeSortChange={onPracticeSortChange}
    />
  )
  expect(received.SessionLeaderboard.sortBy).toBe('bestLap')
  expect(received.SessionLeaderboard.onSortChange).toBe(onPracticeSortChange)
})
