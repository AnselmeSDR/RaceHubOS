import { test, expect } from '@playwright/test'

// Complete Settings flows include the unchanged voice menu on the race PC.
test.setTimeout(60000)

const voices = [
  { id: 'de_DE-thorsten-medium', language: 'de', locale: 'de-DE', name: 'Thorsten' },
  { id: 'en_US-ljspeech-high', language: 'en', locale: 'en-US', name: 'LJ Speech' },
  { id: 'fr_FR-siwis-medium', language: 'fr', locale: 'fr-FR', name: 'Siwis' },
]
async function prepare(page, language = 'en', preference = null, { realAudio = false } = {}) {
  await page.addInitScript(
    ({ lang, realAudio }) => {
      localStorage.setItem('racehubos-lang', lang)
      window.__spoken = []
      window.__cancels = 0
      Object.defineProperty(window, 'speechSynthesis', {
        value: {
          speaking: false,
          getVoices: () => [
            { voiceURI: 'fixture-fr', name: 'Browser FR', lang: 'fr-FR' },
            { voiceURI: 'fixture-en', name: 'Browser EN', lang: 'en-US' },
          ],
          addEventListener() {},
          removeEventListener() {},
          cancel() {
            window.__cancels++
          },
          speak(utterance) {
            window.__spoken.push({
              text: utterance.text,
              lang: utterance.lang,
              rate: utterance.rate,
              volume: utterance.volume,
              voice: utterance.voice?.voiceURI || null,
            })
            setTimeout(() => utterance.onend?.(), 20)
          },
        },
      })
      window.SpeechSynthesisUtterance = class {
        constructor(text) {
          this.text = text
        }
      }
      if (!realAudio) {
        HTMLMediaElement.prototype.play = function () {
          setTimeout(() => this.onended?.(), 20)
          return Promise.resolve()
        }
      }
    },
    { lang: language, realAudio }
  )
  await page.route('**/api/preferences/bestLapVoice:voiceId', (route) =>
    route.request().method() === 'GET' ? route.fulfill({ json: { success: true, data: preference } }) : route.continue()
  )
}
function status(overrides = {}) {
  return {
    supported: true,
    installed: false,
    available: false,
    removable: false,
    phase: 'idle',
    voices: [],
    downloadBytes: 261257585,
    ...overrides,
  }
}

test('browser defaults, explicit voices, force and localized durations match main without Piper', async ({ page }) => {
  await prepare(page)
  await page.route('**/api/voice/status*', (route) => route.fulfill({ json: status() }))
  const localCalls = []
  await page.route('**/api/voice/speak', (route) => {
    localCalls.push(route.request().postDataJSON())
    return route.fulfill({ status: 503 })
  })
  await page.goto('/tests/fixtures/voice-probe.html')
  await page.waitForFunction(() => !!window.__voiceProbe)
  const returned = await page.evaluate(
    () => window.__voiceProbe.speak('Default') instanceof window.SpeechSynthesisUtterance
  )
  expect(returned).toBe(true)
  expect(await page.evaluate(() => window.__spoken[0])).toEqual({
    text: 'Default',
    lang: 'en-US',
    rate: 1.1,
    volume: 0.9,
    voice: null,
  })
  await page.evaluate(() => {
    window.speechSynthesis.speaking = true
  })
  expect(await page.evaluate(() => window.__voiceProbe.speak('busy'))).toBeNull()
  expect(
    await page.evaluate(
      () => window.__voiceProbe.speak('forced', { force: true }) instanceof window.SpeechSynthesisUtterance
    )
  ).toBe(true)
  await page.evaluate(() => {
    window.speechSynthesis.speaking = false
    window.__voiceProbe.saveVoiceId('fixture-fr')
  })
  await expect.poll(() => page.evaluate(() => window.__voiceProbe.voiceId)).toBe('fixture-fr')
  await page.evaluate(() => window.__voiceProbe.speak('Selected', { rate: 0.8, volume: 0.4 }))
  expect(await page.evaluate(() => window.__spoken.at(-1))).toEqual({
    text: 'Selected',
    lang: 'en-US',
    rate: 0.8,
    volume: 0.4,
    voice: 'fixture-fr',
  })
  expect(localCalls).toEqual([])
  expect(await page.evaluate(() => window.__voiceProbe.formatTimeVoice(61234))).toBe('1 minute 1.234')
  await page.evaluate(() => window.__voiceProbe.i18n.changeLanguage('de'))
  expect(await page.evaluate(() => window.__voiceProbe.formatTimeVoice(61234))).toBe('1 Minute 1,234')
  await page.evaluate(() => window.__voiceProbe.i18n.changeLanguage('fr'))
  expect(await page.evaluate(() => window.__voiceProbe.formatTimeVoice(61234))).toBe('1 minute 1,234')
  await page.evaluate(() => window.__voiceProbe.i18n.addResource('fr', 'voice', 'seconds', 'FROM_JSON {{value}}'))
  expect(await page.evaluate(() => window.__voiceProbe.formatTimeVoice(1234))).toBe('FROM_JSON 1,234')
})

test('Settings shows size before opt-in, installs next to browser voices, removes and falls back', async ({ page }) => {
  await prepare(page)
  let installed = false
  const mutations = []
  const synthesis = []
  await page.route('**/api/voice/status*', (route) =>
    route.fulfill({
      json: status({ installed, available: installed, removable: installed, voices: installed ? voices : [] }),
    })
  )
  await page.route('**/api/voice/install', (route) => {
    mutations.push('install')
    installed = true
    return route.fulfill({ status: 202, json: status({ phase: 'installing' }) })
  })
  await page.route('**/api/voice/installation', (route) => {
    mutations.push('remove')
    installed = false
    return route.fulfill({ json: status() })
  })
  await page.route('**/api/voice/speak', (route) => {
    synthesis.push(route.request().postDataJSON())
    return route.fulfill({ status: 200, contentType: 'audio/wav', body: Buffer.from('RIFF1234WAVEdata') })
  })
  await page.goto('/settings')
  await page.getByTestId('voice-selector').waitFor({ timeout: 20000 })
  await expect(page.getByTestId('offline-download-size')).toContainText('249.2 MiB')
  expect(mutations).toEqual([])
  await page.getByTestId('offline-install').click()
  await expect(page.getByTestId('offline-status')).toHaveText('Offline voices installed.')
  await page.getByTestId('voice-test').click()
  await expect.poll(() => page.evaluate(() => window.__spoken.length)).toBe(1)
  expect(await page.evaluate(() => window.__spoken[0])).toMatchObject({ rate: 1.1, volume: 0.9, voice: null })
  expect(synthesis).toEqual([])
  await page.evaluate(() => {
    window.__spoken = []
  })
  await page.getByTestId('voice-selector').click()
  await expect(page.getByRole('option', { name: 'Browser EN (en-US)' })).toBeVisible()
  await page.getByRole('option', { name: 'LJ Speech · en-US · Piper', exact: true }).press('Enter')
  await page.getByTestId('voice-test').click()
  await expect.poll(() => synthesis.length).toBe(1)
  expect(synthesis[0]).toMatchObject({ voiceId: '_piper:en_US-ljspeech-high', rate: 1.1, language: 'en' })
  expect(await page.evaluate(() => window.__spoken)).toEqual([])
  await page.getByTestId('offline-remove').click()
  await expect(page.getByTestId('offline-status')).toHaveText('No complete offline voice installation.')
  await expect(page.getByTestId('voice-selector')).toContainText('Saved Piper choice, voice unavailable')
  await page.getByTestId('voice-test').click()
  await expect.poll(() => page.evaluate(() => window.__spoken.length)).toBe(1)
  expect(await page.evaluate(() => window.__spoken[0])).toMatchObject({
    rate: 1.1,
    volume: 0.9,
    voice: null,
    lang: 'en-US',
  })
  expect(mutations).toEqual(['install', 'remove'])
})

test('failed selected local synthesis preserves browser defaults and completion callback', async ({ page }) => {
  await prepare(page, 'en', { en: '_piper:en_US-ljspeech-high' })
  await page.route('**/api/voice/status*', (route) =>
    route.fulfill({ json: status({ installed: true, available: true, removable: true, voices }) })
  )
  await page.route('**/api/voice/speak', (route) => route.fulfill({ status: 503 }))
  await page.goto('/tests/fixtures/voice-probe.html')
  await page.waitForFunction(
    () => window.__voiceProbe?.localVoices.length === 3 && window.__voiceProbe?.voiceId.startsWith('_piper')
  )
  await page.evaluate(() => {
    window.__completed = 0
    const result = window.__voiceProbe.speak('Fallback')
    result.onend = () => window.__completed++
  })
  await expect.poll(() => page.evaluate(() => window.__completed)).toBe(1)
  expect(await page.evaluate(() => window.__spoken[0])).toEqual({
    text: 'Fallback',
    rate: 1.1,
    volume: 0.9,
    voice: null,
    lang: 'en-US',
  })
})

for (const [language, installText] of [
  ['fr', 'Installer les voix hors ligne'],
  ['de', 'Offline-Stimmen installieren'],
]) {
  test(`offline controls translated in ${language}, failed install stays optional`, async ({ page }) => {
    await prepare(page, language)
    await page.route('**/api/voice/status*', (route) => route.fulfill({ json: status() }))
    await page.route('**/api/voice/install', (route) => route.fulfill({ status: 503 }))
    await page.goto('/settings')
    await page.getByTestId('voice-selector').waitFor({ timeout: 20000 })
    await expect(page.getByTestId('offline-install')).toHaveText(installText)
    await page.getByTestId('offline-install').click()
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByTestId('offline-install')).toBeEnabled()
    await page.getByTestId('voice-test').click()
    await expect.poll(() => page.evaluate(() => window.__spoken.length)).toBe(1)
  })
}

test('changing language cancels stale local audio and retains browser speech in the new language', async ({ page }) => {
  await prepare(page, 'en', { en: '_piper:en_US-ljspeech-high' })
  await page.route('**/api/voice/status*', (route) =>
    route.fulfill({ json: status({ installed: true, available: true, removable: true, voices }) })
  )
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  await page.route('**/api/voice/speak', async (route) => {
    await gate
    try {
      await route.fulfill({ status: 200, contentType: 'audio/wav', body: Buffer.from('RIFF1234WAVEdata') })
    } catch {
      /* Request was cancelled. */
    }
  })
  await page.goto('/tests/fixtures/voice-probe.html')
  await page.waitForFunction(
    () => window.__voiceProbe?.localVoices.length === 3 && window.__voiceProbe?.voiceId.startsWith('_piper')
  )
  const sent = page.waitForRequest('**/api/voice/speak')
  await page.evaluate(() => window.__voiceProbe.speak('Old language'))
  await sent
  await page.evaluate(() => window.__voiceProbe.i18n.changeLanguage('fr'))
  release()
  await page.evaluate(() => window.__voiceProbe.speak('Nouvelle langue'))
  await expect.poll(() => page.evaluate(() => window.__spoken.length)).toBe(1)
  expect(await page.evaluate(() => window.__spoken[0])).toMatchObject({
    text: 'Nouvelle langue',
    lang: 'fr-FR',
    rate: 1.1,
    volume: 0.9,
    voice: null,
  })
})

test('legacy auto-Piper preference displays the installed voice without silently rewriting it', async ({ page }) => {
  await prepare(page, 'en', { en: '_piper-auto' })
  let writes = 0
  await page.route('**/api/preferences/bestLapVoice:voiceId', (route) => {
    if (route.request().method() !== 'GET') writes++
    return route.fulfill({ json: { success: true, data: { en: '_piper-auto' } } })
  })
  await page.route('**/api/voice/status*', (route) =>
    route.fulfill({ json: status({ installed: true, available: true, removable: true, voices }) })
  )
  await page.goto('/settings')
  await page.getByTestId('voice-selector').waitFor({ timeout: 20000 })
  await expect(page.getByTestId('voice-selector')).toContainText('LJ Speech · en-US · Piper')
  expect(writes).toBe(0)
})

test('Piper preview interrupts stale speech and reports fallback failure so Play can be retried', async ({ page }) => {
  await prepare(page, 'en', { en: '_piper:en_US-ljspeech-high' })
  await page.route('**/api/voice/status*', (route) => route.fulfill({ json: status() }))
  await page.goto('/settings')
  await page.getByTestId('voice-selector').waitFor({ timeout: 20000 })
  await expect(page.getByTestId('voice-selector')).toContainText('Saved Piper choice, voice unavailable')
  await page.evaluate(() => {
    window.speechSynthesis.speaking = true
    window.speechSynthesis.speak = (utterance) => {
      window.__spoken.push({ voice: utterance.voice?.voiceURI })
      setTimeout(() => utterance.onerror?.({ error: 'synthesis-unavailable' }), 0)
    }
  })
  await page.getByTestId('voice-test').click()
  await expect(page.getByTestId('voice-preview-status')).toContainText('Playback failed')
  expect(await page.evaluate(() => window.__cancels)).toBeGreaterThan(0)
  await page.evaluate(() => {
    window.speechSynthesis.speak = (utterance) => {
      window.__spoken.push({ voice: utterance.voice?.voiceURI })
      setTimeout(() => utterance.onend?.({ type: 'end' }), 0)
    }
  })
  await page.getByTestId('voice-test').click()
  await expect(page.getByTestId('voice-preview-status')).toHaveText('Voice test finished.')
  expect(await page.evaluate(() => window.__spoken.at(-1).voice)).toBeUndefined()
})

test('Piper download reports bytes, verified archives and cancellation without changing browser voices', async ({
  page,
}) => {
  await prepare(page)
  let installing = false
  let cancelled = false
  await page.route('**/api/voice/status*', (route) =>
    route.fulfill({
      json: status({
        phase: installing ? 'installing' : 'idle',
        stage: installing ? 'extracting' : 'idle',
        fileIndex: 2,
        fileCount: 5,
        verifiedFiles: 2,
        downloadedBytes: 1048576,
        cancelled,
      }),
    })
  )
  await page.route('**/api/voice/install', (route) => {
    installing = true
    return route.fulfill({ status: 202, json: status({ phase: 'installing' }) })
  })
  await page.route('**/api/voice/cancel', (route) => {
    installing = false
    cancelled = true
    return route.fulfill({ status: 202, json: status({ cancelled: true }) })
  })
  await page.goto('/settings')
  await page.getByTestId('voice-selector').waitFor({ timeout: 20000 })
  await page.getByTestId('offline-install').click()
  await expect(page.getByTestId('offline-progress')).toContainText('1 / 249.2 MiB')
  await expect(page.getByTestId('offline-progress')).toContainText('Checksums verified: 2 / 5')
  await expect(page.getByTestId('offline-progress')).toContainText('Extracting verified archive')
  await page.getByTestId('offline-cancel').click()
  await expect(page.getByTestId('offline-cancelled')).toContainText('Previously installed voices are preserved.')
  await expect(page.getByTestId('offline-install')).toBeEnabled()
  await page.getByTestId('voice-test').click()
  await expect.poll(() => page.evaluate(() => window.__spoken.length)).toBe(1)
  expect(await page.evaluate(() => window.__spoken[0])).toMatchObject({ voice: null, rate: 1.1, volume: 0.9 })
})

test('Piper preview plays real WAV audio after synthesis outlasts transient user activation', async ({ page }) => {
  await prepare(page, 'en', { en: '_piper:en_US-ljspeech-high' }, { realAudio: true })
  await page.route('**/api/voice/status*', (route) =>
    route.fulfill({ json: status({ installed: true, available: true, removable: true, voices }) })
  )
  const pcm = Buffer.alloc(22050 * 2)
  const header = Buffer.alloc(44)
  header.write('RIFF')
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write('WAVEfmt ', 8)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(22050, 24)
  header.writeUInt32LE(44100, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(pcm.length, 40)
  await page.route('**/api/voice/speak', async (route) => {
    // Deliberately exceed the usual five-second transient user-activation window.
    await new Promise((resolve) => setTimeout(resolve, 6000))
    await route.fulfill({ contentType: 'audio/wav', body: Buffer.concat([header, pcm]) })
  })
  await page.goto('/settings')
  await page.getByTestId('voice-selector').waitFor({ timeout: 20000 })
  await expect(page.getByTestId('voice-selector')).toContainText('LJ Speech')
  await page.getByTestId('voice-test').click()
  await expect(page.getByTestId('voice-preview-status')).toHaveText('Voice test finished.', { timeout: 15000 })
  expect(await page.evaluate(() => window.__spoken)).toEqual([])
})

test('Piper defaults to the interface language and downloads extra languages only when explicitly selected', async ({
  page,
}) => {
  await prepare(page, 'de')
  const requested = []
  await page.route('**/api/voice/status*', (route) => {
    const languages = new URL(route.request().url()).searchParams.get('languages')
    if (languages) requested.push(languages)
    return route.fulfill({ json: status() })
  })
  let selected
  await page.route('**/api/voice/install', (route) => {
    selected = route.request().postDataJSON().languages
    return route.fulfill({ status: 202, json: status({ phase: 'installing' }) })
  })
  await page.goto('/settings')
  await page.getByTestId('voice-selector').waitFor({ timeout: 20000 })
  await expect(page.getByTestId('offline-language-en')).not.toBeChecked()
  await expect(page.getByTestId('offline-language-fr')).not.toBeChecked()
  await expect.poll(() => requested.at(-1)).toBe('de')
  await page.getByTestId('offline-language-fr').check()
  await expect.poll(() => requested.at(-1)).toBe('de,fr')
  await page.getByTestId('offline-install').click()
  expect(selected).toEqual(['de', 'fr'])
})
