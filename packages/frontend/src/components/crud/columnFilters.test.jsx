import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ColumnFilterHeader from './ColumnFilterHeader'
import { ColumnFilterContext } from './columnFilterContext'
import { filteredColumn } from './filteredColumn'
import LinkCell from './LinkCell'

afterEach(cleanup)

test('a link cell opens its page without selecting the row', async () => {
  const onOpen = vi.fn()
  const onRowClick = vi.fn()
  render(
    <div onClick={onRowClick}>
      <LinkCell to="/drivers/d1" onOpen={onOpen}>
        Ana
      </LinkCell>
    </div>
  )
  await userEvent.click(screen.getByText('Ana'))
  expect(onOpen).toHaveBeenCalledWith('/drivers/d1')
  expect(onRowClick).not.toHaveBeenCalled()
})

test('a filtered column has the filter header and says what it filters', () => {
  const accessorFn = (row) => row.name
  const cell = () => null
  expect(filteredColumn('driver', 'driverId', 'Driver', accessorFn, cell)).toEqual({
    id: 'driver',
    accessorFn,
    meta: { label: 'Driver', filter: 'driverId' },
    header: ColumnFilterHeader,
    cell,
  })
})

describe('ColumnFilterHeader', () => {
  const column = { columnDef: { meta: { filter: 'driverId', label: 'Driver' } }, getCanSort: () => false }

  function header(context) {
    render(
      <ColumnFilterContext.Provider value={context}>
        <ColumnFilterHeader column={column} />
      </ColumnFilterContext.Provider>
    )
  }

  test('the filter of its column, from the context', async () => {
    const setFilter = vi.fn()
    header({
      filters: { driverId: ['d1'] },
      setFilter,
      options: {
        driverId: [
          { value: 'd1', label: 'Ana' },
          { value: 'd2', label: 'Ben' },
        ],
      },
    })
    expect(screen.getByText('Driver')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button'))
    expect(await screen.findByRole('menuitemcheckbox', { name: 'Ana' })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Ben' }))
    expect(setFilter).toHaveBeenCalledWith('driverId', ['d1', 'd2'])
  })

  test('nothing selected and no choices by default', async () => {
    header({ filters: {}, setFilter: vi.fn(), options: {} })
    await userEvent.click(screen.getByRole('button'))
    expect(screen.queryByRole('menuitemcheckbox', { name: 'Ana' })).not.toBeInTheDocument()
  })
})
