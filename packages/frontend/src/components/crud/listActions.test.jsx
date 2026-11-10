import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import CardActions from './CardActions'
import { editColumn } from './editColumn'

beforeAll(() => i18n.changeLanguage('en'))

describe('CardActions', () => {
  test('edit and delete never open the card itself', async () => {
    const user = userEvent.setup()
    const open = vi.fn()
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    render(
      <div onClick={open}>
        <CardActions onEdit={onEdit} onDelete={onDelete} />
      </div>
    )
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(onEdit).toHaveBeenCalledTimes(1)
    await user.click(screen.getByTestId('delete-button'))
    await user.click(screen.getByTestId('delete-button'))
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(open).not.toHaveBeenCalled()
  })

  test('without onEdit, only delete', () => {
    render(<CardActions onDelete={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.getByTestId('delete-button')).toBeInTheDocument()
  })
})

test('editColumn: a pencil that edits the row without opening it', async () => {
  const onEdit = vi.fn()
  const open = vi.fn()
  const column = editColumn(onEdit)
  expect(column).toMatchObject({ id: 'actions', header: '', enableSorting: false, enableHiding: false })
  render(<div onClick={open}>{column.cell({ row: { original: { id: 'x' } } })}</div>)
  await userEvent.click(screen.getByRole('button'))
  expect(onEdit).toHaveBeenCalledWith({ id: 'x' })
  expect(open).not.toHaveBeenCalled()
})
