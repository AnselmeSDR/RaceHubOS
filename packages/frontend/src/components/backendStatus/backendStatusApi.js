const API_URL = import.meta.env.VITE_API_URL || ''

const json = (path) => fetch(`${API_URL}${path}`).then((res) => res.json())

/** The server's health, the Control Unit's Bluetooth state and the simulator's, read together. */
export async function fetchBackendStatus() {
  const [health, bluetooth, simulator] = await Promise.all([
    json('/health'),
    json('/api/bluetooth/status'),
    json('/api/simulator'),
  ])
  return { health, bluetooth, simulator }
}
