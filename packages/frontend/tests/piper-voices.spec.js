import { test, expect } from '@playwright/test'
const localVoices = [
  { id: 'de_DE-thorsten-medium', language: 'de', locale: 'de-DE', name: 'Thorsten' },
  { id: 'en_US-ljspeech-high', language: 'en', locale: 'en-US', name: 'LJ Speech' },
  { id: 'fr_FR-siwis-medium', language: 'fr', locale: 'fr-FR', name: 'Siwis' },
]
async function prepare(page, language, voices = localVoices) {
  await page.addInitScript((lang) => {
    localStorage.setItem('racehubos-lang', lang)
    window.__spoken = []
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        speaking: false,
        getVoices: () => [
          { voiceURI: 'fixture-fr', name: 'Browser FR', lang: 'fr-FR' },
          { voiceURI: 'fixture-en', name: 'Browser EN', lang: 'en-US' },
        ],
        addEventListener() {},
        removeEventListener() {},
        cancel() {},
        speak(u) {
          window.__spoken.push({ lang: u.lang, text: u.text })
          setTimeout(() => u.onend?.(), 50)
        },
      },
    })
    window.SpeechSynthesisUtterance = class {
      constructor(text) {
        this.text = text
      }
    }
    HTMLMediaElement.prototype.play = function () {
      setTimeout(() => this.onended?.(), 100)
      return Promise.resolve()
    }
  }, language)
  await page.route('**/api/voice/status', (r) => r.fulfill({ json: { available: voices.length > 0, voices } }))
  await page.route('**/api/preferences/bestLapVoice:voiceId', (r) =>
    r.request().method() === 'GET' ? r.fulfill({ json: { success: true, data: '_piper-auto' } }) : r.continue()
  )
  await page.goto('/settings')
  await expect(page.getByTestId('voice-selector')).toBeVisible()
}
for (const [lang, id, label] of [
  ['en', 'en_US-ljspeech-high', 'LJ Speech'],
  ['fr', 'fr_FR-siwis-medium', 'Siwis'],
])
  test(`${lang}: local voice selection, sample and persisted preference`, async ({ page }) => {
    const errors = [],
      calls = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.route('**/api/voice/speak', (r) => {
      calls.push(r.request().postDataJSON())
      return r.fulfill({ status: 200, contentType: 'audio/wav', body: Buffer.from('RIFF1234WAVEdata') })
    })
    await prepare(page, lang)
    await page.getByTestId('voice-test').click()
    await expect.poll(() => calls.length).toBe(1)
    expect(calls[0].language).toBe(lang)
    expect(calls[0].voiceId).toBe('_piper:' + id)
    await page.getByTestId('voice-selector').click()
    await page.getByRole('option', { name: new RegExp(label) }).click()
    await expect(page.getByTestId('voice-selector')).toContainText(label)
    expect(errors).toEqual([])
  })
test('missing voice uses matching browser speech without sending a synthesis request', async ({ page }) => {
  let calls = 0
  await page.route('**/api/voice/speak', (r) => {
    calls++
    return r.fulfill({ status: 503 })
  })
  await prepare(page, 'fr', [])
  await expect(page.getByTestId('piper-voice-status')).toContainText('Aucune voix')
  await page.getByTestId('voice-test').click()
  await expect.poll(() => page.evaluate(() => window.__spoken.length)).toBe(1)
  expect(await page.evaluate(() => window.__spoken[0].lang)).toBe('fr-FR')
  expect(calls).toBe(0)
  await page.screenshot({ path: '../../../piper-browser-fallback.png', fullPage: true })
})
test('failed synthesis falls back and changing interface language changes the next model', async ({ page }) => {
  const calls = []
  await page.route('**/api/voice/speak', (r) => {
    calls.push(r.request().postDataJSON())
    return r.fulfill({ status: 503 })
  })
  await prepare(page, 'fr')
  await page.getByTestId('voice-test').click()
  await expect.poll(() => page.evaluate(() => window.__spoken.length)).toBe(1)
  await page.getByRole('combobox').filter({ hasText: 'Français' }).click()
  await page.getByRole('option', { name: 'English', exact: true }).click()
  await page.getByTestId('voice-test').click()
  await expect.poll(() => calls.length).toBe(2)
  expect(calls[1].language).toBe('en')
  expect(calls[1].voiceId).toBe('_piper:en_US-ljspeech-high')
  await page.screenshot({ path: '../../../piper-settings-en.png', fullPage: true })
})
