import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import { routeFetch } from '@/test/helpers'
import { DataTable, createSelectColumn } from './data-table'

const rows = [
  { id: 'a', name: 'Ayrton', team: 'Red', laps: 30 },
  { id: 'b', name: 'Bruno', team: 'Blue', laps: 12 },
  { id: 'c', name: 'Carlos', team: 'Red', laps: 21 },
]
const columns = [
  createSelectColumn((key) => ({ selectAll: 'Select all', selectRow: 'Select row' })[key]),
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'team', header: 'Team' },
  { accessorKey: 'laps', header: 'Laps' },
  { id: 'actions', header: '', cell: () => <span>edit</span>, enableSorting: false, enableHiding: false },
]

const headers = () => screen.getAllByRole('columnheader').map((th) => th.textContent.replace('⠿', ''))
const names = () => screen.getAllByTestId('list-row').map((row) => within(row).getAllByRole('cell')[1].textContent)
const saved = (fetch, key) =>
  fetch.mock.calls
    .filter(([url, init]) => url.endsWith(`/api/preferences/${key}`) && init?.method === 'PUT')
    .map(([, init]) => JSON.parse(init.body).value)

beforeAll(() => i18n.changeLanguage('en'))
afterEach(() => vi.unstubAllGlobals())

test('the search keeps the rows that match in any column; the empty message when none does', async () => {
  render(<DataTable columns={columns} data={rows} searchPlaceholder="Find a driver" emptyMessage="Nobody" />)
  expect(names()).toEqual(['Ayrton', 'Bruno', 'Carlos'])

  const search = screen.getByPlaceholderText('Find a driver')
  await userEvent.type(search, 'red')
  expect(names()).toEqual(['Ayrton', 'Carlos'])

  await userEvent.type(search, 'x')
  expect(screen.queryByTestId('list-row')).not.toBeInTheDocument()
  expect(screen.getByText('Nobody')).toBeInTheDocument()
})

test('a header sorts its column, numbers from the largest then from the smallest; the actions column does not sort', async () => {
  render(<DataTable columns={columns} data={rows} />)
  await userEvent.click(screen.getByText('Laps'))
  expect(names()).toEqual(['Ayrton', 'Carlos', 'Bruno'])
  await userEvent.click(screen.getByText('Laps'))
  expect(names()).toEqual(['Bruno', 'Carlos', 'Ayrton'])

  await userEvent.click(screen.getAllByRole('columnheader').at(-1))
  expect(names()).toEqual(['Bruno', 'Carlos', 'Ayrton'])
})

test('with onSortChange the caller sorts: told the column and direction, the rows left as given', async () => {
  const onSortChange = vi.fn()
  render(<DataTable columns={columns} data={rows} onSortChange={onSortChange} />)
  await userEvent.click(screen.getByText('Laps'))
  expect(onSortChange).toHaveBeenLastCalledWith({ id: 'laps', desc: true })
  expect(names()).toEqual(['Ayrton', 'Bruno', 'Carlos'])

  await userEvent.click(screen.getByText('Laps'))
  expect(onSortChange).toHaveBeenLastCalledWith({ id: 'laps', desc: false })
  await userEvent.click(screen.getByText('Laps'))
  expect(onSortChange).toHaveBeenLastCalledWith(null)
})

test('a column is hidden from the Columns menu, the choice saved; select and actions are not offered', async () => {
  const fetch = routeFetch({ 'PUT /api/preferences/': { success: true } })
  render(<DataTable columns={columns} data={rows} preferenceKey="drivers" />)

  await userEvent.click(screen.getByRole('button', { name: 'Columns' }))
  expect(screen.getAllByRole('menuitemcheckbox').map((item) => item.textContent)).toEqual(['Name', 'Team', 'Laps'])
  await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Team' }))
  // The open menu hides the table from the queries
  await userEvent.keyboard('{Escape}')

  expect(headers()).toEqual(['', 'Name', 'Laps', ''])
  expect(saved(fetch, 'columns:drivers')).toEqual([{ team: false }])
})

test('the saved choices apply at start: hidden columns, and the order with a column added since after its neighbour', () => {
  // `team` did not exist when the order was saved: it goes back after `name`, where it is defined
  const initialPrefs = { columnVisibility: { name: false }, columnOrder: ['select', 'laps', 'name', 'gone', 'actions'] }
  render(<DataTable columns={columns} data={rows} initialPrefs={initialPrefs} />)
  expect(headers()).toEqual(['', 'Laps', 'Team', ''])
})

test('a header dragged onto another takes its place, the order saved; actions stay last', () => {
  const fetch = routeFetch({ 'PUT /api/preferences/': { success: true } })
  render(<DataTable columns={columns} data={rows} preferenceKey="drivers" />)
  const header = (name) => screen.getByRole('columnheader', { name: new RegExp(name) })
  const handle = within(header('Laps')).getByText('⠿')

  fireEvent.dragStart(handle, { dataTransfer: {} })
  fireEvent.dragEnter(header('Name'))
  // Never onto the actions column
  fireEvent.dragEnter(screen.getAllByRole('columnheader').at(-1))
  fireEvent.dragEnd(handle)

  expect(headers()).toEqual(['', 'Laps', 'Name', 'Team', ''])
  expect(saved(fetch, 'order:drivers')).toEqual([['select', 'laps', 'name', 'team', 'actions']])
})

test('ticked rows are counted and handed to the actions, without opening the row; all at once; cleared from outside', async () => {
  const onRowClick = vi.fn()
  const onSelectionChange = vi.fn()
  const clearSelectionRef = { current: null }
  render(
    <DataTable
      columns={columns}
      data={rows}
      onRowClick={onRowClick}
      onSelectionChange={onSelectionChange}
      clearSelectionRef={clearSelectionRef}
      renderActions={(selected) => <button>Delete {selected.map((row) => row.original.name).join(', ')}</button>}
    />
  )
  const selection = () => onSelectionChange.mock.lastCall[0].map((row) => row.original.id)
  expect(screen.queryByText(/selected/)).not.toBeInTheDocument()

  await userEvent.click(screen.getAllByRole('checkbox', { name: 'Select row' })[1])
  expect(screen.getByText('1 selected')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Delete Bruno' })).toBeInTheDocument()
  expect(screen.getAllByTestId('list-row')[1]).toHaveAttribute('data-state', 'selected')
  expect(selection()).toEqual(['b'])
  expect(onRowClick).not.toHaveBeenCalled()

  await userEvent.click(screen.getByRole('checkbox', { name: 'Select all' }))
  expect(screen.getByText('3 selected')).toBeInTheDocument()
  expect(selection()).toEqual(['a', 'b', 'c'])

  act(() => clearSelectionRef.current())
  expect(screen.queryByText(/selected/)).not.toBeInTheDocument()
  expect(selection()).toEqual([])
})

test('a row clicked opens its record; each row takes its own class and carries its id', async () => {
  const onRowClick = vi.fn()
  render(
    <DataTable
      columns={columns}
      data={rows}
      onRowClick={onRowClick}
      rowClassName={(row) => (row.team === 'Blue' ? 'opacity-50' : '')}
    />
  )
  const [first, second] = screen.getAllByTestId('list-row')
  expect(first).not.toHaveClass('opacity-50')
  expect(second).toHaveClass('opacity-50')
  expect(second).toHaveAttribute('data-entity-id', 'b')

  await userEvent.click(within(second).getByText('Bruno'))
  expect(onRowClick).toHaveBeenCalledWith(rows[1])
})

test('an option under the search is ticked', async () => {
  const onChange = vi.fn()
  const options = [{ key: 'deleted', label: 'Show deleted', checked: false, onChange }]
  render(<DataTable columns={columns} data={rows} options={options} />)
  await userEvent.click(screen.getByRole('checkbox', { name: 'Show deleted' }))
  expect(onChange).toHaveBeenCalledWith(true)
})

test('the end of the table coming into view asks for more, unless loading or nothing is left', () => {
  let seen
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback) {
        seen = (isIntersecting) => callback([{ isIntersecting }])
      }
      observe() {}
      disconnect() {}
    }
  )
  const onLoadMore = vi.fn()
  const table = (props) => <DataTable columns={columns} data={rows} onLoadMore={onLoadMore} {...props} />
  const { rerender } = render(table({ hasMore: true }))
  seen(false)
  expect(onLoadMore).not.toHaveBeenCalled()
  seen(true)
  expect(onLoadMore).toHaveBeenCalledTimes(1)

  rerender(table({ hasMore: true, loadingMore: true }))
  seen(true)
  rerender(table({ hasMore: false }))
  seen(true)
  expect(onLoadMore).toHaveBeenCalledTimes(1)
})
