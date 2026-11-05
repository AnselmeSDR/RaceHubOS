import { normalizeScreens } from './raceScreen.js'
const url = `${import.meta.env.VITE_API_URL || ''}/api/preferences/raceScreen:settings`
export async function loadScreens() {
  const response = await fetch(url)
  const body = await response.json()
  if (!response.ok || !body.success) throw new Error('Unable to load race screen settings')
  return normalizeScreens(body.data)
}
export async function saveScreens(value) {
  const settings = normalizeScreens(value)
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: settings }),
  })
  if (!response.ok || !(await response.json()).success) throw new Error('Unable to save race screen settings')
  window.dispatchEvent(new Event('race:screen-settings'))
  return settings
}
