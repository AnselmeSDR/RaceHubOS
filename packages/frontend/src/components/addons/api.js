const API_URL = import.meta.env.VITE_API_URL || ''

// Not /api/addons: that prefix belongs to the add-ons themselves — docs/ADDONS.md
export const MANAGER_URL = '/api/addon-manager'

function actionRequest(action, { id, repo, deleteData }) {
  switch (action) {
    case 'install':
      return { url: `${MANAGER_URL}/install`, method: 'POST', body: id ? { id } : { repo } }
    case 'uninstall':
      return { url: `${MANAGER_URL}/${id}${deleteData ? '?delete_data=1' : ''}`, method: 'DELETE' }
    default:
      return { url: `${MANAGER_URL}/${id}/${action}`, method: 'POST' }
  }
}

/**
 * Starts an add-on action. The server answers once it is checked; the work then shows on
 * `addons:progress`.
 *
 * @returns {Promise<{ action: string, addon: string|null }>}
 * @throws {Error} with the server's reason (not in the catalog, already installed…)
 */
export async function startAddonAction(action, params = {}) {
  const { url, method, body } = actionRequest(action, params)
  const res = await fetch(`${API_URL}${url}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`)
  return data.data
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Resolves once the server has gone down and come back: until it goes down, the old one
 * is still answering. `downTimeout` covers a restart too quick to be seen.
 */
export async function waitForRestart({ interval = 1000, downTimeout = 15000, fetchImpl = fetch, wait = sleep } = {}) {
  const up = async () => {
    try {
      return (await fetchImpl(`${API_URL}/api`)).ok
    } catch {
      return false
    }
  }
  for (let waited = 0; waited < downTimeout && (await up()); waited += interval) await wait(interval)
  while (!(await up())) await wait(interval)
}
