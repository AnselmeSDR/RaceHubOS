import { act, renderHook } from '@testing-library/react'
import i18n from '@/i18n'
import { useEntityForm } from './useEntityForm'

let fetchMock
const reply = (status, body = {}) => ({ ok: status < 400, status, json: async () => body })

beforeAll(() => i18n.changeLanguage('en'))
beforeEach(() => {
  fetchMock = vi.fn(async () => reply(200))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const form = (options = {}) =>
  renderHook(() =>
    useEntityForm({
      endpoint: '/api/teams',
      initial: { name: 'Red' },
      savedMessage: 'Saved!',
      onClose: vi.fn(),
      ...options,
    })
  )

test('a new record is POSTed, then the form says so and closes', async () => {
  vi.useFakeTimers()
  const onClose = vi.fn()
  const { result } = form({ onClose })
  expect(result.current.formProps).toMatchObject({ open: true, isEditing: false, saving: false, error: '' })

  act(() => result.current.setField('name')('Blue'))
  expect(result.current.formData).toEqual({ name: 'Blue' })
  await act(() => result.current.formProps.onSubmit())

  const [url, options] = fetchMock.mock.calls[0]
  expect(url).toMatch(/\/api\/teams$/)
  expect(options).toMatchObject({ method: 'POST', body: JSON.stringify({ name: 'Blue' }) })
  expect(result.current.formProps).toMatchObject({ success: 'Saved!', saving: false })
  expect(onClose).not.toHaveBeenCalled()
  act(() => vi.advanceTimersByTime(1500))
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('an existing record is PUT to its own url, shaped by toBody', async () => {
  const { result } = form({ record: { id: 't1' }, toBody: (data) => ({ label: data.name.toUpperCase() }) })
  expect(result.current.formProps.isEditing).toBe(true)
  act(() => result.current.setFormData((f) => ({ ...f, name: 'green' })))
  await act(() => result.current.formProps.onSubmit())

  const [url, options] = fetchMock.mock.calls[0]
  expect(url).toMatch(/\/api\/teams\/t1$/)
  expect(options).toMatchObject({ method: 'PUT', body: JSON.stringify({ label: 'GREEN' }) })
})

test.each([
  ['with its reason', reply(400, { error: 'Name taken' }), 'Name taken'],
  ['without reason', reply(500, {}), 'Error while saving'],
])('a refusal %s is shown and the form stays open', async (_, answer, message) => {
  fetchMock.mockResolvedValue(answer)
  const onClose = vi.fn()
  const { result } = form({ onClose })
  await act(() => result.current.formProps.onSubmit())
  expect(result.current.formProps).toMatchObject({ error: message, success: '', saving: false })
  expect(onClose).not.toHaveBeenCalled()
})

test('an unreachable server is a connection error; the next try clears it', async () => {
  fetchMock.mockRejectedValue(new Error('down'))
  const { result } = form()
  await act(() => result.current.formProps.onSubmit())
  expect(result.current.formProps.error).toBe('Server connection error')

  fetchMock.mockResolvedValue(reply(200))
  await act(() => result.current.formProps.onSubmit())
  expect(result.current.formProps.error).toBe('')
})

test('fields can report their own errors', () => {
  const { result } = form()
  act(() => result.current.setError('Image too large'))
  expect(result.current.formProps.error).toBe('Image too large')
})
