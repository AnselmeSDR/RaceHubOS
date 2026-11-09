import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import { PageHeaderProvider, usePageHeader } from '@/context/PageHeaderContext'
import { jsonReply } from '@/test/helpers'
import Cars from './Cars'
import Drivers from './Drivers'
import Teams from './Teams'
import Tracks from './Tracks'

const pages = [
  {
    name: 'cars',
    Page: Cars,
    record: { id: 'x1', brand: 'Porsche', model: '911' },
    newTitle: 'New car',
    editTitle: 'Edit car',
    opens: 'profile',
  },
  {
    name: 'drivers',
    Page: Drivers,
    record: { id: 'x1', name: 'Ayrton', color: '#FFCC00' },
    newTitle: 'New driver',
    editTitle: 'Edit driver',
    opens: 'profile',
  },
  {
    name: 'tracks',
    Page: Tracks,
    record: { id: 'x1', name: 'Monza' },
    newTitle: 'New track',
    editTitle: 'Edit track',
    opens: 'profile',
  },
  {
    name: 'teams',
    Page: Teams,
    record: { id: 'x1', name: 'McLaren' },
    newTitle: 'New team',
    editTitle: 'Edit team',
    opens: 'form',
  },
]
let fetchMock

/** The list answers one record; preferences and teams answer nothing. */
function stubApi({ name, record }) {
  fetchMock = vi.fn(async (url, options = {}) => {
    if (new URL(url, 'http://x').pathname === `/api/${name}` && !options.method) {
      return jsonReply({ success: true, data: [record], total: 1, hasMore: false })
    }
    if (url.includes('/api/teams')) return jsonReply({ success: true, data: [{ id: 'tm1', name: 'McLaren' }] })
    return jsonReply({ success: false })
  })
  vi.stubGlobal('fetch', fetchMock)
}
const listCalls = (name) =>
  fetchMock.mock.calls.filter(
    ([url, options = {}]) => new URL(url, 'http://x').pathname === `/api/${name}` && !options.method
  )

/** What the layout shows of the page header: its add button. */
function HeaderAddButton() {
  const { header } = usePageHeader()
  return header?.onAdd ? <button onClick={header.onAdd}>{header.addLabel}</button> : null
}

function renderPage({ name, Page }) {
  return render(
    <PageHeaderProvider>
      <HeaderAddButton />
      <MemoryRouter initialEntries={[`/${name}`]}>
        <Routes>
          <Route path={`/${name}`} element={<Page />} />
          <Route path={`/${name}/:id`} element={<p>profile page</p>} />
        </Routes>
      </MemoryRouter>
    </PageHeaderProvider>
  )
}

beforeAll(() => i18n.changeLanguage('en'))
afterEach(() => vi.unstubAllGlobals())

describe.each(pages)('$name page', (page) => {
  test('shows its records as cards', async () => {
    stubApi(page)
    renderPage(page)
    const card = await screen.findByTestId('entity-card')
    expect(card).toHaveAttribute('data-entity-id', 'x1')
  })

  test(`a card opens the ${page.opens}`, async () => {
    stubApi(page)
    renderPage(page)
    await userEvent.click(await screen.findByTestId('entity-card'))
    if (page.opens === 'profile') expect(screen.getByText('profile page')).toBeInTheDocument()
    else expect(within(screen.getByTestId('modal')).getByText(page.editTitle)).toBeInTheDocument()
  })

  test('adding opens an empty form; closing it reloads the list', async () => {
    const user = userEvent.setup()
    stubApi(page)
    renderPage(page)
    await screen.findByTestId('entity-card')
    await user.click(screen.getByRole('button', { name: i18n.t(`${page.name}:addLabel`) }))
    const modal = screen.getByTestId('modal')
    expect(modal).toHaveTextContent(page.newTitle)

    await user.click(within(modal).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
    await waitFor(() => expect(listCalls(page.name)).toHaveLength(2))
  })

  test('deleting from a card reloads the list', async () => {
    const user = userEvent.setup()
    stubApi(page)
    renderPage(page)
    const card = await screen.findByTestId('entity-card')
    await user.click(within(card).getByTestId('delete-button'))
    await user.click(within(card).getByTestId('delete-button'))

    await waitFor(() => expect(listCalls(page.name)).toHaveLength(2))
    const deletion = fetchMock.mock.calls.find(([, options]) => options?.method === 'DELETE')
    expect(deletion[0]).toMatch(new RegExp(`/api/${page.name}/x1$`))
  })
})

describe.each(pages.filter((p) => p.opens === 'profile'))('$name page edit button', (page) => {
  test('the card pencil opens the form of that record', async () => {
    stubApi(page)
    renderPage(page)
    const card = await screen.findByTestId('entity-card')
    await userEvent.click(within(card).getByRole('button', { name: 'Edit' }))
    expect(within(screen.getByTestId('modal')).getByText(page.editTitle)).toBeInTheDocument()
    expect(screen.queryByText('profile page')).not.toBeInTheDocument()
  })
})

test('the driver form lists the teams', async () => {
  const page = pages.find((p) => p.name === 'drivers')
  stubApi(page)
  renderPage(page)
  await userEvent.click(within(await screen.findByTestId('entity-card')).getByRole('button', { name: 'Edit' }))
  expect(within(screen.getByTestId('modal')).getByRole('option', { name: 'McLaren' })).toBeInTheDocument()
})

test.each([
  ['refused', async () => jsonReply({ success: false })],
  ['empty', async () => jsonReply({ success: true })],
  ['unreachable', async () => Promise.reject(new Error('down'))],
])('the drivers page without its teams list (%s) still works', async (_, teamsAnswer) => {
  const page = pages.find((p) => p.name === 'drivers')
  stubApi(page)
  const original = fetchMock.getMockImplementation()
  fetchMock.mockImplementation((url, options) => (url.includes('/api/teams') ? teamsAnswer() : original(url, options)))
  renderPage(page)
  expect(await screen.findByTestId('entity-card')).toBeInTheDocument()
})

describe.each(pages)('$name page in table view', (page) => {
  test(`a row opens the ${page.opens}`, async () => {
    stubApi(page)
    const original = fetchMock.getMockImplementation()
    fetchMock.mockImplementation(async (url, options) =>
      url.endsWith(`/api/preferences/viewMode:${page.name}`)
        ? jsonReply({ success: true, data: 'list' })
        : original(url, options)
    )
    renderPage(page)
    const name = page.record.name ?? page.record.model
    await userEvent.click(await screen.findByRole('cell', { name: new RegExp(name) }))
    if (page.opens === 'profile') expect(screen.getByText('profile page')).toBeInTheDocument()
    else expect(within(screen.getByTestId('modal')).getByText(page.editTitle)).toBeInTheDocument()
  })
})
