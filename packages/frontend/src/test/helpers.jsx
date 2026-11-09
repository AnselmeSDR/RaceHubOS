import { render, screen } from '@testing-library/react'

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
