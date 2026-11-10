import { SessionStatus } from '@racehubos/shared'
import { routeFetch } from '@/test/helpers'
import {
  deleteChampionship,
  finishChampionship,
  getChampionship,
  getChampionshipSessions,
  getStandings,
} from './championshipApi'

const sent = (mock, method) =>
  mock.mock.calls.filter(([, init]) => init?.method === method).map(([url, init]) => [url, JSON.parse(init.body)])

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('a championship and its sessions, null when they cannot be read', async () => {
  routeFetch({
    '/api/championships/c1': { success: true, data: { id: 'c1' } },
    '/api/championships/c2': { success: false },
    '/api/sessions?championshipId=c1': { success: true, data: [{ id: 's1' }] },
    '/api/sessions?championshipId=c2': new Error('offline'),
  })
  expect(await getChampionship('c1')).toEqual({ id: 'c1' })
  expect(await getChampionship('c2')).toBeNull()
  expect(await getChampionshipSessions('c1')).toEqual([{ id: 's1' }])
  expect(await getChampionshipSessions('c2')).toBeNull()
  expect(console.error).toHaveBeenCalledOnce()
})

test('the standings of each session type, empty when missing', async () => {
  const mock = routeFetch({
    '/api/championships/c1/standings?type=practice': { standings: ['p'] },
    '/api/championships/c1/standings?type=qualif': { standings: ['q'] },
    '/api/championships/c1/standings?type=race': {},
  })
  expect(await getStandings('c1')).toEqual({ practice: ['p'], qualif: ['q'], race: [] })
  expect(mock).toHaveBeenCalledTimes(3)
  routeFetch({ '/api/championships': new Error('offline') })
  expect(await getStandings('c1')).toBeNull()
})

test('finishing a championship gives its new state', async () => {
  const mock = routeFetch({ 'PUT /api/championships/c1': { data: { id: 'c1', status: SessionStatus.FINISHED } } })
  expect(await finishChampionship('c1')).toEqual({ id: 'c1', status: SessionStatus.FINISHED })
  expect(sent(mock, 'PUT')).toEqual([['/api/championships/c1', { status: SessionStatus.FINISHED }]])
  routeFetch({ 'PUT /api/championships/c1': 500 })
  expect(await finishChampionship('c1')).toBeNull()
  routeFetch({ 'PUT /api/championships/c1': new Error('offline') })
  expect(await finishChampionship('c1')).toBeNull()
  expect(console.error).toHaveBeenCalledOnce()
})

test('deleting a championship', async () => {
  const mock = routeFetch({ 'DELETE /api/championships/c1': { success: true } })
  await deleteChampionship('c1')
  expect(mock).toHaveBeenCalledWith('/api/championships/c1', { method: 'DELETE' })
})
