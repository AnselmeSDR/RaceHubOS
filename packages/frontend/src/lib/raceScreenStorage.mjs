import { tx } from '../i18n/raceScreens'
import { normalizeScreens } from './raceScreen.mjs'
const preferenceURL = `${import.meta.env.VITE_API_URL || ''}/api/preferences/raceScreenLayout`
export async function loadScreen() {
  const collection = await loadScreens()
  return collection.profiles.find((p) => p.id === collection.activeProfile).layout
}
export async function loadScreens() {
  const response = await fetch(preferenceURL)
  if (!response.ok) throw new Error(tx('Layout konnte nicht geladen werden.'))
  const data = await response.json()
  if (!data.success) throw new Error(tx('Layout konnte nicht geladen werden.'))
  return normalizeScreens(data.data)
}
export async function saveScreens(value) {
  const collection = normalizeScreens(value)
  const active = collection.profiles.find((p) => p.id === collection.activeProfile).layout
  const response = await fetch(preferenceURL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: { ...active, ...collection } }),
  })
  if (!response.ok || !(await response.json()).success)
    throw new Error(tx('Speichern fehlgeschlagen. Bitte erneut versuchen.'))
  window.dispatchEvent(new Event('race:layout-saved'))
}
