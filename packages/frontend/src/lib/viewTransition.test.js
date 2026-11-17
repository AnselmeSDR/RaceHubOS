import { pictureName, withViewTransition } from './viewTransition'

afterEach(() => {
  delete document.startViewTransition
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

test('a picture has one name on its line, its card and its profile, safe for CSS', () => {
  expect(pictureName('driver', 'cm12ab')).toBe('driver-cm12ab')
  expect(pictureName('car', 'a b/"c')).toBe('car-abc')
  expect(pictureName('track', 7)).toBe('track-7')
})

test('where the browser cannot, or with reduced motion, the update simply runs', () => {
  const update = vi.fn()
  withViewTransition(update)
  expect(update).toHaveBeenCalledTimes(1)

  document.startViewTransition = vi.fn()
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  withViewTransition(update)
  expect(update).toHaveBeenCalledTimes(2)
  expect(document.startViewTransition).not.toHaveBeenCalled()
})

test('as a transition, the update runs inside it, which waits for the picture of the new page', async () => {
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  let finished
  document.startViewTransition = vi.fn((run) => (finished = run()))
  const update = vi.fn()
  withViewTransition(update, 'driver-d1')
  expect(update).toHaveBeenCalledTimes(1)

  let done = false
  finished.then(() => (done = true))
  await Promise.resolve()
  expect(done).toBe(false)
  // The profile has loaded: its header shows the picture
  document.body.innerHTML = '<span data-vt="driver-d1"></span>'
  await finished
  expect(done).toBe(true)
})

test('the picture of the page being left does not count: the next page has to bring its own', async () => {
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  // The router has not rendered the next page yet: the line's picture is still there
  document.body.innerHTML = '<span id="line" data-vt="driver-d1"></span>'
  let finished
  document.startViewTransition = (run) => (finished = run())
  withViewTransition(() => {}, 'driver-d1')

  let done = false
  finished.then(() => (done = true))
  await new Promise((resolve) => setTimeout(resolve, 20))
  expect(done).toBe(false)
  document.body.innerHTML = '<span id="header" data-vt="driver-d1"></span>'
  await finished
  expect(done).toBe(true)
})

test('a picture that never comes does not hold the page for long', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  let finished
  document.startViewTransition = (run) => (finished = run())
  withViewTransition(() => {}, 'driver-gone')
  await vi.advanceTimersByTimeAsync(500)
  await expect(finished).resolves.toBeUndefined()
  vi.useRealTimers()
})
