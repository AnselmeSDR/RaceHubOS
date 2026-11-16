import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import { PageHeaderProvider, usePageHeader } from '@/context/PageHeaderContext'
import { routeFetch } from '@/test/helpers'
import { ListPage } from './list-page'

const data = [
  { id: 'a', name: 'Ayrton' },
  { id: 'b', name: 'Bruno' },
]
const columns = [{ accessorKey: 'name', header: 'Name' }]
const PREFS = '/api/preferences/'

/** What the layout shows of the page header: the count, the view and its switch. */
function Header() {
  const { header } = usePageHeader()
  if (!header) return null
  return (
    <div data-testid="header">
      {header.title} {header.totalCount} {header.hasGrid ? header.viewMode : 'no grid'}
      <button onClick={() => header.onViewModeChange('list')}>as list</button>
    </div>
  )
}

function renderList(props = {}) {
  return render(
    <PageHeaderProvider>
      <Header />
      <ListPage
        title="Drivers"
        data={data}
        columns={columns}
        preferenceKey="drivers"
        renderGrid={(records) => <p>cards of {records.map((record) => record.name).join(', ')}</p>}
        {...props}
      />
    </PageHeaderProvider>
  )
}

const calls = (fetch, method) => fetch.mock.calls.filter(([, init = {}]) => init.method === method).map(([url]) => url)
const pick = async (...names) => {
  for (const name of names) {
    const row = screen.getByRole('cell', { name }).closest('tr')
    await userEvent.click(within(row).getByRole('checkbox'))
  }
}

beforeAll(() => i18n.changeLanguage('en'))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('the view saved for the list wins, then the default one, then the cards', async () => {
  routeFetch({ [PREFS]: { success: true, data: null }, [`${PREFS}viewMode:default`]: { success: true, data: 'list' } })
  const { unmount } = renderList()
  expect(await screen.findByRole('cell', { name: 'Ayrton' })).toBeInTheDocument()
  expect(screen.getByTestId('header')).toHaveTextContent('Drivers 2 list')
  unmount()

  routeFetch({
    [PREFS]: { success: true, data: null },
    [`${PREFS}viewMode:default`]: { success: true, data: 'list' },
    [`${PREFS}viewMode:drivers`]: { success: true, data: 'grid' },
  })
  renderList({ totalCount: 40 })
  expect(await screen.findByText('cards of Ayrton, Bruno')).toBeInTheDocument()
  expect(screen.getByTestId('header')).toHaveTextContent('Drivers 40 grid')
})

test('switching the view shows the table and saves the choice; unreadable preferences leave the cards', async () => {
  const fetch = routeFetch({ [`GET ${PREFS}`]: new Error('offline'), [`PUT ${PREFS}`]: { success: true } })
  renderList()
  expect(await screen.findByText('cards of Ayrton, Bruno')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'as list' }))
  expect(screen.getByRole('cell', { name: 'Bruno' })).toBeInTheDocument()
  const [url, init] = fetch.mock.calls.find(([, options = {}]) => options.method === 'PUT')
  expect(url).toBe(`${PREFS}viewMode:drivers`)
  expect(JSON.parse(init.body)).toEqual({ value: 'list' })
})

test('a list without cards is a table, with its saved columns', async () => {
  routeFetch({
    [PREFS]: { success: true, data: null },
    [`${PREFS}columns:drivers`]: { success: true, data: { name: false } },
  })
  renderList({ renderGrid: undefined })
  await waitFor(() => expect(screen.getAllByTestId('list-row')).toHaveLength(2))
  expect(screen.getByTestId('header')).toHaveTextContent('no grid')
  expect(screen.queryByRole('cell', { name: 'Ayrton' })).not.toBeInTheDocument()
})

test('nothing yet: a title, a message and the way to add; with a filter on, the table says nothing matches', async () => {
  routeFetch({ [PREFS]: { success: true, data: null } })
  const onAdd = vi.fn()
  const empty = { data: [], onAdd, addLabel: 'New driver', emptyTitle: 'No driver', emptyMessage: 'Add the first one' }
  const { unmount } = renderList(empty)
  expect(await screen.findByText('No driver')).toBeInTheDocument()
  expect(screen.getByText('Add the first one')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'New driver' }))
  expect(onAdd).toHaveBeenCalled()
  unmount()

  renderList({ ...empty, hasActiveFilters: true, renderGrid: undefined })
  expect(await screen.findByText('No results found.')).toBeInTheDocument()
  expect(screen.queryByText('No driver')).not.toBeInTheDocument()
})

test('while loading, neither the cards nor the table', () => {
  routeFetch({ [PREFS]: { success: true, data: null } })
  renderList({ loading: true })
  expect(screen.queryByText(/cards of/)).not.toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
})

test('the ticked rows are deleted once confirmed, then the list reloads with nothing ticked; cancelling sends nothing', async () => {
  const fetch = routeFetch({ [PREFS]: { success: true, data: null }, 'DELETE /api/drivers/': { success: true } })
  const onDeleted = vi.fn()
  renderList({ renderGrid: undefined, deleteEndpoint: '/api/drivers', onDeleted })
  await screen.findByRole('cell', { name: 'Ayrton' })
  await pick('Ayrton', 'Bruno')

  await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
  expect(screen.getByText('2 items will be deleted.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByText('Confirm deletion')).not.toBeInTheDocument()
  expect(calls(fetch, 'DELETE')).toEqual([])
  expect(screen.getByText('2 selected')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
  // The confirmation's own button comes after the one of the selection bar
  await userEvent.click(screen.getAllByRole('button', { name: 'Delete' }).at(-1))
  await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1))
  expect(calls(fetch, 'DELETE')).toEqual(['/api/drivers/a', '/api/drivers/b'])
  expect(screen.queryByText(/selected/)).not.toBeInTheDocument()
  expect(screen.queryByText('Confirm deletion')).not.toBeInTheDocument()
})

test('in the bin, the ticked rows are restored, or deleted for good after a warning', async () => {
  const fetch = routeFetch({
    [PREFS]: { success: true, data: null },
    'PATCH /api/drivers/': { success: true },
    'DELETE /api/drivers/': { success: true },
  })
  const onDeleted = vi.fn()
  const options = [{ key: 'deleted', label: 'Show deleted', checked: true, onChange: () => {} }]
  renderList({ renderGrid: undefined, deleteEndpoint: '/api/drivers', onDeleted, options })
  await screen.findByRole('cell', { name: 'Ayrton' })

  await pick('Bruno')
  await userEvent.click(screen.getByRole('button', { name: 'Restore' }))
  await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1))
  expect(calls(fetch, 'PATCH')).toEqual(['/api/drivers/b/restore'])
  expect(screen.queryByText(/selected/)).not.toBeInTheDocument()

  await pick('Ayrton')
  await userEvent.click(screen.getByRole('button', { name: 'Delete permanently' }))
  expect(screen.getByText('Permanent deletion')).toBeInTheDocument()
  expect(screen.getByText('1 item will be permanently deleted. This action is irreversible.')).toBeInTheDocument()
})

test('the ticked rows are exported by their ids; no action without an endpoint', async () => {
  const fetch = routeFetch({ [PREFS]: { success: true, data: null }, '/api/drivers/export': 500 })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const { unmount } = renderList({ renderGrid: undefined, exportEndpoint: '/api/drivers/export' })
  await screen.findByRole('cell', { name: 'Ayrton' })
  await pick('Ayrton', 'Bruno')
  await userEvent.click(screen.getByRole('button', { name: 'Export (2)' }))
  expect(fetch).toHaveBeenCalledWith('/api/drivers/export?ids=a,b')
  expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  unmount()

  renderList({ renderGrid: undefined })
  await screen.findByRole('cell', { name: 'Ayrton' })
  await pick('Ayrton')
  expect(screen.getByText('1 selected')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Export|Delete/ })).not.toBeInTheDocument()
})
