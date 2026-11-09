import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import AppearanceSettings from './AppearanceSettings'

const { app, voice } = vi.hoisted(() => ({ app: {}, voice: {} }))
vi.mock('@/context/AppContext', () => ({ useApp: () => app }))
vi.mock('@/context/VoiceContext', () => ({ useVoice: () => voice }))

const json = (body) => ({ ok: true, json: async () => body })
const thomas = { voiceURI: 'thomas', name: 'Thomas', lang: 'fr-FR' }
const daniel = { voiceURI: 'daniel', name: 'Daniel', lang: 'en-GB' }
let fetchMock
let synth

beforeEach(async () => {
  await i18n.changeLanguage('en')
  Object.assign(app, { isDark: false, toggleTheme: vi.fn(), isAdmin: false, toggleAdmin: vi.fn() })
  Object.assign(voice, {
    bestLapEnabled: false,
    saveBestLapEnabled: vi.fn(),
    podiumEnabled: false,
    savePodiumEnabled: vi.fn(),
    minLaps: 3,
    saveMinLaps: vi.fn(),
    voiceId: '',
    saveVoiceId: vi.fn(),
    speak: vi.fn(),
  })
  const listeners = new Set()
  synth = {
    voices: [thomas, daniel],
    getVoices: () => synth.voices,
    addEventListener: (_, listener) => listeners.add(listener),
    removeEventListener: (_, listener) => listeners.delete(listener),
    listeners,
  }
  vi.stubGlobal('speechSynthesis', synth)
  fetchMock = vi.fn(async () => json({ success: true, data: null }))
  vi.stubGlobal('fetch', fetchMock)
})
// Unmount first: the voice list listener is removed from the stubbed speechSynthesis
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
afterAll(() => i18n.changeLanguage('en'))

const switchNamed = (name) => screen.getByRole('switch', { name })

describe('appearance', () => {
  test('day theme; switching calls the app', async () => {
    render(<AppearanceSettings />)
    expect(screen.getByText('Light interface')).toBeInTheDocument()
    expect(switchNamed('Day mode')).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(switchNamed('Day mode'))
    expect(app.toggleTheme).toHaveBeenCalled()
  })

  test('night theme', () => {
    app.isDark = true
    render(<AppearanceSettings />)
    expect(screen.getByText('Dark interface')).toBeInTheDocument()
    expect(switchNamed('Night mode')).toHaveAttribute('aria-checked', 'true')
  })

  test('the default view is read from the preferences and saved when switched', async () => {
    fetchMock.mockResolvedValue(json({ success: true, data: 'list' }))
    render(<AppearanceSettings />)
    await waitFor(() => expect(switchNamed('Default view')).toHaveAttribute('aria-checked', 'false'))
    expect(screen.getByText('List')).toBeInTheDocument()

    await userEvent.click(switchNamed('Default view'))
    expect(screen.getByText('Grid')).toBeInTheDocument()
    const [url, options] = fetchMock.mock.calls.at(-1)
    expect(url).toMatch(/\/api\/preferences\/viewMode:default$/)
    expect(options).toMatchObject({ method: 'PUT', body: JSON.stringify({ value: 'grid' }) })
  })

  test('the default view stays on grid when the preference is unset or unreadable', async () => {
    fetchMock.mockRejectedValue(new Error('down'))
    render(<AppearanceSettings />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(switchNamed('Default view')).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(switchNamed('Default view'))
    expect(switchNamed('Default view')).toHaveAttribute('aria-checked', 'false')
  })

  test('changing the language changes the interface', async () => {
    const user = userEvent.setup()
    render(<AppearanceSettings />)
    await user.click(screen.getByRole('combobox', { name: 'Language' }))
    await user.click(screen.getByRole('option', { name: 'Deutsch' }))
    expect(i18n.language).toBe('de')
    expect(await screen.findByText('Sprache')).toBeInTheDocument()
  })

  test('admin mode', async () => {
    app.isAdmin = true
    render(<AppearanceSettings />)
    expect(switchNamed('Administrator mode')).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(switchNamed('Administrator mode'))
    expect(app.toggleAdmin).toHaveBeenCalled()
  })
})

describe('voice announcements', () => {
  test('both off: no lap count, no voice choice', async () => {
    render(<AppearanceSettings />)
    expect(screen.queryByText('Minimum laps before announcement')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Test voice')).not.toBeInTheDocument()

    await userEvent.click(switchNamed('Best lap announcement'))
    expect(voice.saveBestLapEnabled).toHaveBeenCalledWith(true)
    await userEvent.click(switchNamed('Podium announcement'))
    expect(voice.savePodiumEnabled).toHaveBeenCalledWith(true)
  })

  test('best lap on: the minimum lap count goes up and down', async () => {
    voice.bestLapEnabled = true
    render(<AppearanceSettings />)
    const row = screen.getByText('Minimum laps before announcement').parentElement
    expect(row).toHaveTextContent('3')
    await userEvent.click(within(row).getByRole('button', { name: '+' }))
    expect(voice.saveMinLaps).toHaveBeenLastCalledWith(4)
    await userEvent.click(within(row).getByRole('button', { name: '-' }))
    expect(voice.saveMinLaps).toHaveBeenLastCalledWith(2)
    await userEvent.click(switchNamed('Best lap announcement'))
    expect(voice.saveBestLapEnabled).toHaveBeenCalledWith(false)
  })

  test('the voices of the interface language come first; choosing one saves it', async () => {
    const user = userEvent.setup()
    voice.podiumEnabled = true
    render(<AppearanceSettings />)
    const picker = screen.getByTestId('settings-voice').querySelector('[role="combobox"]')
    expect(picker).toHaveTextContent('Default voice')

    await user.click(picker)
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Default voice',
      'Daniel (en-GB)',
      'Thomas (fr-FR)',
    ])
    await user.click(screen.getByRole('option', { name: 'Thomas (fr-FR)' }))
    expect(voice.saveVoiceId).toHaveBeenCalledWith('thomas')
  })

  test('the chosen voice is shown; back to the default saves an empty choice', async () => {
    const user = userEvent.setup()
    Object.assign(voice, { podiumEnabled: true, voiceId: 'thomas' })
    render(<AppearanceSettings />)
    const picker = screen.getByTestId('settings-voice').querySelector('[role="combobox"]')
    expect(picker).toHaveTextContent('Thomas (fr-FR)')

    await user.click(picker)
    await user.click(screen.getByRole('option', { name: 'Default voice' }))
    expect(voice.saveVoiceId).toHaveBeenCalledWith('')
  })

  test('voices the browser loads later appear', () => {
    voice.bestLapEnabled = true
    synth.voices = []
    Object.assign(voice, { voiceId: 'daniel' })
    render(<AppearanceSettings />)
    const picker = screen.getByTestId('settings-voice').querySelector('[role="combobox"]')
    expect(picker).toHaveTextContent('Default voice')

    synth.voices = [daniel]
    act(() => synth.listeners.forEach((listener) => listener()))
    expect(picker).toHaveTextContent('Daniel (en-GB)')
  })

  test('the test button speaks a sample sentence', async () => {
    voice.bestLapEnabled = true
    render(<AppearanceSettings />)
    await userEvent.click(screen.getByTitle('Test voice'))
    expect(voice.speak).toHaveBeenCalledWith('Best lap, Anselme, 6.142 seconds')
  })

  test('leaving the page stops listening to the voice list', () => {
    const { unmount } = render(<AppearanceSettings />)
    expect(synth.listeners.size).toBe(1)
    unmount()
    expect(synth.listeners.size).toBe(0)
  })
})
