import ColumnFilterHeader from './ColumnFilterHeader'

/** A column of `id` filtered on the `filter` key of the column filter context, `label` naming it. */
export const filteredColumn = (id, filter, label, accessorFn, cell) => ({
  id,
  accessorFn,
  meta: { label, filter },
  header: ColumnFilterHeader,
  cell,
})
