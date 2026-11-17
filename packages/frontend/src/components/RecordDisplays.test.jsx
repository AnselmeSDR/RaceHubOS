import { render, screen, within } from '@testing-library/react'
import { SessionType } from '@racehubos/shared'
import i18n from '@/i18n'
import { RecordsList } from './RecordDisplays'

const records = [
  {
    id: 'r1',
    lapTime: 7500,
    driver: { id: 'd1', name: 'Ayrton', color: '#FFCC00' },
    car: { id: 'c1', brand: 'Toyota', model: 'Supra', color: '#fff349' },
    track: { id: 't1', name: 'Monza' },
    sessionType: SessionType.RACE,
  },
  {
    id: 'r2',
    lapTime: 61234,
    driver: { id: 'd2', name: 'Bruno', color: '#0000FF' },
    car: { id: 'c2', brand: 'BMW', model: 'M4', color: '#00FF00' },
    track: { id: 't2', name: 'Spa' },
    sessionType: SessionType.QUALIF,
  },
]

beforeAll(() => i18n.changeLanguage('en'))

test('each record in order, with its driver, car, track, kind of session and time', () => {
  render(<RecordsList title="Best laps" records={records} />)
  expect(screen.getByText('Best laps')).toBeInTheDocument()
  const [first, second] = screen.getAllByTestId('record')
  for (const text of ['Ayrton', 'Toyota Supra', 'Monza', 'Race', '7.500']) expect(first).toHaveTextContent(text)
  for (const text of ['Bruno', 'BMW M4', 'Spa', 'Qualifying', '1:01.234']) expect(second).toHaveTextContent(text)
})

test('no record yet: the message given, or the default one', () => {
  const { unmount } = render(<RecordsList records={[]} emptyMessage="Nothing timed" />)
  expect(screen.getByText('Nothing timed')).toBeInTheDocument()
  expect(screen.queryByTestId('record')).not.toBeInTheDocument()
  unmount()
  render(<RecordsList />)
  expect(screen.getByText('Top 10 Records')).toBeInTheDocument()
  expect(screen.getByText('No records yet')).toBeInTheDocument()
})

test('a profile does not repeat what it is about: its own column is left out', () => {
  const { unmount } = render(<RecordsList records={records} hide="driver" />)
  expect(screen.queryByText('Ayrton')).not.toBeInTheDocument()
  expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['#', 'Car', 'Track', 'Type', 'Time'])
  unmount()
  render(<RecordsList records={records} hide="track" />)
  expect(screen.queryByText('Monza')).not.toBeInTheDocument()
  expect(within(screen.getAllByTestId('record')[0]).getByText('Ayrton')).toBeInTheDocument()
})

test('the podium reads from the colour of the rank, the best time in gold', () => {
  render(<RecordsList records={[...records, { ...records[1], id: 'r3' }, { ...records[1], id: 'r4' }]} />)
  const ranks = screen.getAllByTestId('record').map((row) => within(row).getAllByRole('cell')[0])
  expect(ranks.map((rank) => rank.textContent)).toEqual(['1', '2', '3', '4'])
  expect(ranks[0]).toHaveClass('text-yellow-500')
  expect(ranks[3]).toHaveClass('text-muted-foreground')
  expect(screen.getByText('7.500')).toHaveClass('text-yellow-600')
  expect(screen.getAllByText('1:01.234')[0]).not.toHaveClass('text-yellow-600')
})
