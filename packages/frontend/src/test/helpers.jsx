import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

/** The input, textarea or select under the form label `label` (a required field's `*` ignored). */
export function field(label) {
  const node = screen.getByText(
    (_, el) => el?.tagName === 'LABEL' && el.textContent.replace(/\*$/, '').trim() === label
  )
  return node.parentElement.querySelector('input, textarea, select')
}

/** Renders a table column's cell for `original`, as the table would. */
export function renderCell(columns, id, original) {
  const column = columns.find((c) => (c.id ?? c.accessorKey) === id)
  return render(<>{column.cell({ row: { original } })}</>)
}

/** The value a table column sorts `original` by. */
export function sortValue(columns, id, original) {
  const column = columns.find((c) => (c.id ?? c.accessorKey) === id)
  return column.accessorFn ? column.accessorFn(original) : original[column.accessorKey]
}

/** A fetch mock answering `{ ok, json }` with `body`, recording every call. */
export const jsonReply = (body, status = 200) => ({ ok: status < 400, status, json: async () => body })

const REPLY = Symbol('reply')

// A body answered with an error status: routeFetch({ 'PUT /api/x': withStatus(409, { error: '...' }) })
export const withStatus = (status, body) => ({ [REPLY]: jsonReply(body, status) })

/**
 * Stubs fetch with `routes`: `'[METHOD ]/path'` → a body, an error status, an Error to throw, or a function
 * of `(url, init)` returning one. The longest key the URL starts with answers; anything else gets a 404.
 */
export function routeFetch(routes) {
  const mock = vi.fn(async (url, init = {}) => {
    const method = init.method || 'GET'
    const key = Object.keys(routes)
      .filter((k) => {
        const [m, path] = k.includes(' ') ? k.split(' ') : [null, k]
        return (!m || m === method) && url.startsWith(path)
      })
      .sort((a, b) => b.length - a.length)[0]
    if (!key) return jsonReply({}, 404)
    const reply = typeof routes[key] === 'function' ? routes[key](url, init) : routes[key]
    if (reply instanceof Error) throw reply
    if (reply?.[REPLY]) return reply[REPLY]
    return typeof reply === 'number' ? jsonReply({}, reply) : jsonReply(reply)
  })
  vi.stubGlobal('fetch', mock)
  return mock
}
