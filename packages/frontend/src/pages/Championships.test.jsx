import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ChampionshipStatus } from '@racehubos/shared'
import i18n from '@/i18n'
import { PageHeaderProvider, usePageHeader } from '@/context/PageHeaderContext'
import { routeFetch } from '@/test/helpers'
import Championships from './Championships'

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
vi.mock('@/components/championship/ChampionshipWizard', () => spy('ChampionshipWizard'))

const tracks = [{ id: 't1', name: 'Monza' }]
let mock

const listQueries = () =>
  mock.mock.calls
    .filter(([url, init]) => new URL(url, 'http://x').pathname === '/api/championships' && !init?.method)
    .map(([url]) => Object.fromEntries(new URL(url, 'http://x').searchParams))

function HeaderAddButton() {
  const { header } = usePageHeader()
  return header?.onAdd ? <button onClick={header.onAdd}>{header.addLabel}</button> : null
}

async function shown() {
  render(
    <PageHeaderProvider>
      <HeaderAddButton />
      <MemoryRouter initialEntries={['/championships']}>
        <Routes>
          <Route path="/championships" element={<Championships />} />
          <Route path="/championships/:id" element={<div data-testid="championship-page" />} />
        </Routes>
      </MemoryRouter>
    </PageHeaderProvider>
  )
  await screen.findByText('Winter Cup')
}

beforeAll(() => i18n.changeLanguage('en'))
beforeEach(() => {
  for (const key of Object.keys(received)) delete received[key]
  mock = routeFetch({
    '/api/championships': { success: true, data: [{ id: 'c1', name: 'Winter Cup', trackId: 't1' }], total: 1 },
    '/api/tracks': { success: true, data: tracks },
    '/api/preferences': { success: false },
  })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

test('a championship opens its page, its track named', async () => {
  await shown()
  expect(screen.getByText('Monza')).toBeInTheDocument()
  await userEvent.click(screen.getByText('Winter Cup'))
  expect(screen.getByTestId('championship-page')).toBeInTheDocument()
})

test('a deleted championship does not open', async () => {
  await shown()
  await userEvent.click(screen.getByText('Show deleted items'))
  await waitFor(() => expect(listQueries().at(-1)).toMatchObject({ deleted: 'true' }))
  await userEvent.click(screen.getByText('Winter Cup'))
  expect(screen.queryByTestId('championship-page')).not.toBeInTheDocument()
})

test.each([
  ['Track', 'Monza', { trackId: 't1' }],
  ['Status', 'Finished', { status: ChampionshipStatus.FINISHED }],
])('the %s filter reloads with %s', async (columnName, option, expected) => {
  await shown()
  const header = screen.getByRole('columnheader', { name: new RegExp(columnName) })
  await userEvent.click(within(header).getByRole('button'))
  await userEvent.click(await screen.findByRole('menuitemcheckbox', { name: option }))
  await waitFor(() => expect(listQueries().at(-1)).toMatchObject(expected))
})

test('adding opens the wizard; closing it reloads the list', async () => {
  await shown()
  await userEvent.click(screen.getByRole('button', { name: 'New championship' }))
  expect(received.ChampionshipWizard).toMatchObject({ tracks })
  const before = listQueries().length
  act(() => received.ChampionshipWizard.onClose())
  expect(screen.queryByTestId('ChampionshipWizard')).not.toBeInTheDocument()
  await waitFor(() => expect(listQueries().length).toBe(before + 1))
})

test('a championship created by the wizard reloads the list', async () => {
  await shown()
  await userEvent.click(screen.getByRole('button', { name: 'New championship' }))
  const before = listQueries().length
  act(() => received.ChampionshipWizard.onCreated())
  await waitFor(() => expect(listQueries().length).toBe(before + 1))
  expect(screen.getByTestId('ChampionshipWizard')).toBeInTheDocument()
})
