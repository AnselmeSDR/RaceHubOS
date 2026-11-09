import { act, renderHook, waitFor } from '@testing-library/react'
import i18n from '@/i18n'
import { usePagedList } from './usePagedList'

const json = (body) => ({ ok: true, json: async () => body })
const page = (ids, extra = {}) => json({ success: true, data: ids.map((id) => ({ id })), ...extra })
let fetchMock

const query = (call) => Object.fromEntries(new URL(fetchMock.mock.calls[call][0], 'http://x').searchParams)
const ids = (result) => result.current.items.map((item) => item.id)

beforeAll(() => i18n.changeLanguage('en'))
beforeEach(() => {
  fetchMock = vi.fn(async () => page(['a', 'b'], { hasMore: true, total: 3 }))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('loads the first 50 records', async () => {
  const { result } = renderHook(() => usePagedList('/api/cars'))
  expect(result.current.listProps.loading).toBe(true)
  await waitFor(() => expect(result.current.listProps.loading).toBe(false))

  expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/cars\?/)
  expect(query(0)).toEqual({ offset: '0', limit: '50' })
  expect(ids(result)).toEqual(['a', 'b'])
  expect(result.current.listProps).toMatchObject({ data: result.current.items, totalCount: 3, hasMore: true })
})

test('loads the next page after the ones shown', async () => {
  const { result } = renderHook(() => usePagedList('/api/cars'))
  await waitFor(() => expect(ids(result)).toEqual(['a', 'b']))

  let answer
  fetchMock.mockReturnValue(new Promise((resolve) => (answer = resolve)))
  act(() => result.current.listProps.onLoadMore())
  expect(result.current.listProps.loadingMore).toBe(true)
  expect(query(1)).toMatchObject({ offset: '2' })

  answer(page(['c']))
  await waitFor(() => expect(result.current.listProps.loadingMore).toBe(false))
  expect(ids(result)).toEqual(['a', 'b', 'c'])
  expect(result.current.listProps.hasMore).toBe(false)
  // The total is the first page's: the next ones don't send it again
  expect(result.current.listProps.totalCount).toBe(3)
})

test('a page that fails to load keeps the list as it was', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const { result } = renderHook(() => usePagedList('/api/cars'))
  await waitFor(() => expect(ids(result)).toEqual(['a', 'b']))

  fetchMock.mockRejectedValue(new Error('down'))
  act(() => result.current.listProps.onLoadMore())
  await waitFor(() => expect(result.current.listProps.loadingMore).toBe(false))
  expect(ids(result)).toEqual(['a', 'b'])
  expect(console.error).toHaveBeenCalledWith('Failed to load /api/cars:', expect.any(Error))

  fetchMock.mockResolvedValue(json({ success: false }))
  act(() => result.current.listProps.onLoadMore())
  await waitFor(() => expect(result.current.listProps.loadingMore).toBe(false))
  expect(ids(result)).toEqual(['a', 'b'])
})

test('a first page that fails still ends the loading', async () => {
  fetchMock.mockResolvedValue(json({ success: false }))
  const { result } = renderHook(() => usePagedList('/api/cars'))
  await waitFor(() => expect(result.current.listProps.loading).toBe(false))
  expect(result.current.items).toEqual([])
})

test('a page without hasMore nor total', async () => {
  fetchMock.mockResolvedValue(page(['a']))
  const { result } = renderHook(() => usePagedList('/api/cars'))
  await waitFor(() => expect(ids(result)).toEqual(['a']))
  expect(result.current.listProps).toMatchObject({ hasMore: false, totalCount: 0 })
})

test('sorting reloads from the start, without the loading screen', async () => {
  const { result } = renderHook(() => usePagedList('/api/cars'))
  await waitFor(() => expect(result.current.listProps.loading).toBe(false))

  fetchMock.mockResolvedValue(page(['z']))
  act(() => result.current.listProps.onSortChange({ id: 'brand', desc: true }))
  expect(result.current.listProps.loading).toBe(false)
  await waitFor(() => expect(ids(result)).toEqual(['z']))
  expect(query(1)).toEqual({ sortBy: 'brand', sortOrder: 'desc', offset: '0', limit: '50' })

  act(() => result.current.listProps.onSortChange({ id: 'year', desc: false }))
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
  expect(query(2)).toMatchObject({ sortBy: 'year', sortOrder: 'asc' })
})

test('"show deleted" reloads the deleted records, dimmed', async () => {
  const { result } = renderHook(() => usePagedList('/api/cars'))
  await waitFor(() => expect(result.current.listProps.loading).toBe(false))
  const [option] = result.current.listProps.options
  expect(option).toMatchObject({ key: 'deleted', label: 'Show deleted items', checked: false })
  expect(result.current.listProps.rowClassName()).toBe('')

  act(() => option.onChange(true))
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  expect(query(1)).toMatchObject({ deleted: 'true' })
  expect(result.current.showDeleted).toBe(true)
  expect(result.current.listProps).toMatchObject({ hasActiveFilters: true })
  expect(result.current.listProps.options[0].checked).toBe(true)
  expect(result.current.listProps.rowClassName()).toBe('opacity-50')
})

test('reload and onDeleted fetch the first page again', async () => {
  const { result } = renderHook(() => usePagedList('/api/cars'))
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
  act(() => result.current.reload())
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  act(() => result.current.listProps.onDeleted())
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
  expect(query(2)).toMatchObject({ offset: '0' })
})

describe('query parameters', () => {
  test('are sent with every page', async () => {
    const { result } = renderHook(() => usePagedList('/api/laps', { driverId: 'd1,d2', unique: 'true' }))
    await waitFor(() => expect(ids(result)).toEqual(['a', 'b']))
    expect(query(0)).toEqual({ driverId: 'd1,d2', unique: 'true', offset: '0', limit: '50' })
    act(() => result.current.listProps.onLoadMore())
    expect(query(1)).toMatchObject({ driverId: 'd1,d2', offset: '2' })
  })

  test('reload the list when they change, not when they are only rebuilt', async () => {
    const { result, rerender } = renderHook(({ params }) => usePagedList('/api/laps', params), {
      initialProps: { params: { unique: 'true' } },
    })
    await waitFor(() => expect(result.current.listProps.loading).toBe(false))
    rerender({ params: { unique: 'true' } })
    expect(fetchMock).toHaveBeenCalledOnce()
    rerender({ params: { unique: 'false' } })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(query(1)).toMatchObject({ unique: 'false', offset: '0' })
  })
})
