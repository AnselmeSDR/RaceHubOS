import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import * as barrel from '../DriverDisplays'
import DriverBadge from './DriverBadge'
import DriverGridPosition from './DriverGridPosition'
import DriverListItem from './DriverListItem'
import DriverProfileHeader from './DriverProfileHeader'
import DriverSelectCard from './DriverSelectCard'
import DriverStanding from './DriverStanding'
import StatBox from './StatBox'

const { app } = vi.hoisted(() => ({ app: { isDark: false } }))
vi.mock('@/context/AppContext', () => ({ useApp: () => app }))

const ana = {
  name: 'Ana Silva',
  color: '#FF0000',
  number: 7,
  divisions: [{ id: 'dv1', name: 'Gold league', shortName: 'GOLD', color: '#00FF00', scope: 'driver' }],
  wins: 4,
  podiums: 6,
  bestLap: 7123,
  _count: { sessions: 12, laps: 300 },
}
const plain = { name: 'Bo', color: '#000000' }

beforeAll(() => i18n.changeLanguage('en'))
afterEach(() => {
  cleanup()
  app.isDark = false
})

test('the historical import path still gives every display', () => {
  expect({ ...barrel }).toEqual({
    DriverListItem,
    DriverBadge,
    DriverGridPosition,
    DriverProfileHeader,
    DriverStanding,
    DriverSelectCard,
  })
})

describe('DriverListItem', () => {
  test('position, initial, number, name, divisions and stats', async () => {
    const onClick = vi.fn()
    render(<DriverListItem driver={ana} position={3} onClick={onClick} showStats />)
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('7')).toHaveClass('text-2xl')
    expect(screen.getByTitle('Gold league')).toHaveTextContent('GOLD')
    expect(screen.getByText('Races').nextSibling).toHaveTextContent('12')
    expect(screen.getByText('Wins').nextSibling).toHaveTextContent('4')
    await userEvent.click(screen.getByText('Ana Silva'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  test('selected, a picture, a three-digit number, no stats by default', () => {
    const { container } = render(<DriverListItem driver={{ ...ana, img: '/api/img/a.png', number: 107 }} selected />)
    expect(container.firstChild).toHaveClass('ring-blue-500')
    expect(screen.getByAltText('Ana Silva')).toHaveAttribute('src', '/api/img/a.png')
    expect(screen.getByText('107')).toHaveClass('text-xl')
    expect(screen.queryByText('Races')).not.toBeInTheDocument()
  })

  test('zero stats, no position, number or division', () => {
    render(<DriverListItem driver={plain} showStats />)
    expect(screen.getByText('Races').nextSibling).toHaveTextContent('0')
    expect(screen.getByText('Wins').nextSibling).toHaveTextContent('0')
    expect(screen.queryByTestId('division-badge')).not.toBeInTheDocument()
  })
})

describe('DriverBadge', () => {
  test('the number and the name, medium by default', () => {
    render(<DriverBadge driver={ana} />)
    expect(screen.getByText('7').parentElement).toHaveClass('w-12')
    expect(screen.getByText('Ana Silva')).toBeInTheDocument()
  })

  test.each([
    ['sm', 'w-8'],
    ['lg', 'w-16'],
    ['xl', 'w-20'],
  ])('size %s', (size, width) => {
    render(<DriverBadge driver={plain} size={size} showName={false} />)
    expect(screen.getByText('B').parentElement).toHaveClass(width)
    expect(screen.queryByText('Bo')).not.toBeInTheDocument()
  })
})

describe('DriverGridPosition', () => {
  test('the number, the last name, the car and the divisions, on the left by default', () => {
    const { container } = render(<DriverGridPosition driver={ana} subtitle="Audi R8" />)
    expect(container.firstChild).not.toHaveClass('flex-row-reverse')
    expect(screen.getByText('7')).toHaveClass('text-5xl')
    expect(screen.getByText('Silva')).toBeInTheDocument()
    expect(screen.getByText('Audi R8')).toBeInTheDocument()
    expect(screen.getByText('GOLD')).toBeInTheDocument()
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  test('mirrored on the right, with a picture and a three-digit number', () => {
    const { container } = render(
      <DriverGridPosition driver={{ ...plain, img: '/api/img/b.png', number: 123 }} side="right" />
    )
    expect(container.firstChild).toHaveClass('flex-row-reverse')
    // The starting grid shows the picture in the common layer, without shadow
    const picture = screen.getByAltText('Bo')
    expect(picture.parentElement).toHaveClass('rounded-[20%]')
    expect(picture.parentElement.className).not.toMatch(/shadow|ring/)
    expect(screen.getByText('123')).toHaveClass('text-4xl')
  })

  test('a black number gets a white outline in dark mode only', () => {
    const black = { ...plain, number: 9 }
    render(<DriverGridPosition driver={black} />)
    expect(screen.getByText('9').getAttribute('style')).not.toContain('2px white')
    cleanup()
    app.isDark = true
    render(<DriverGridPosition driver={black} />)
    expect(screen.getByText('9').getAttribute('style')).toContain('2px white')
    cleanup()
    render(<DriverGridPosition driver={{ ...ana, number: 9 }} />)
    expect(screen.getByText('9').getAttribute('style')).not.toContain('2px white')
  })
})

describe('DriverProfileHeader', () => {
  test('number, divisions, name and every figure, best lap included', () => {
    render(<DriverProfileHeader driver={ana} />)
    expect(screen.getByText('ANA SILVA')).toBeInTheDocument()
    expect(screen.getByTitle('Gold league')).toHaveStyle({ backgroundColor: '#00FF00' })
    expect(screen.getByText('7')).toHaveClass('text-3xl')
    for (const [label, value] of [
      ['Races', '12'],
      ['Wins', '4'],
      ['Podiums', '6'],
      ['Laps', '300'],
    ]) {
      expect(screen.getByText(label).nextSibling).toHaveTextContent(value)
    }
    expect(screen.getByText('7.123s')).toBeInTheDocument()
  })

  test('a picture, a division without colour, a three-digit number', () => {
    const solo = { id: 'dv2', name: 'Solo', scope: 'driver' }
    render(<DriverProfileHeader driver={{ ...ana, img: '/api/img/a.png', number: 100, divisions: [solo] }} />)
    expect(screen.getByAltText('Ana Silva')).toBeInTheDocument()
    expect(screen.getByText('100')).toHaveClass('text-2xl')
    expect(screen.getByTitle('Solo')).toHaveStyle({ backgroundColor: '#6B7280' })
  })

  test('zeros, and no best lap, number nor division', () => {
    render(<DriverProfileHeader driver={plain} />)
    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.getByText('Wins').nextSibling).toHaveTextContent('0')
    expect(screen.getByText('Laps').nextSibling).toHaveTextContent('0')
    expect(screen.queryByText('Best Lap')).not.toBeInTheDocument()
  })
})

test('a stat box is golden when highlighted', () => {
  render(<StatBox icon={<span>i</span>} label="Wins" value={3} color="#123456" highlight />)
  expect(screen.getByText('3')).toHaveStyle({ color: '#EAB308' })
  expect(screen.getByText('Wins').parentElement).toHaveClass('ring-yellow-400')
  cleanup()
  render(<StatBox icon={<span>i</span>} label="Wins" value={3} color="#123456" />)
  expect(screen.getByText('3')).toHaveStyle({ color: '#123456' })
})

describe('DriverStanding', () => {
  test('a podium position, points and a gain', () => {
    render(<DriverStanding driver={ana} position={1} points={25} change={2} />)
    expect(screen.getByText('1')).toHaveClass('bg-yellow-400')
    expect(screen.getByText('↑2')).toHaveClass('text-green-500')
    expect(screen.getByText('25')).toBeInTheDocument()
    expect(screen.getByText('Points')).toBeInTheDocument()
    expect(screen.getByText('Ana Silva')).toBeInTheDocument()
    expect(screen.getByText('GOLD')).toBeInTheDocument()
  })

  test('a loss, further down, without points', () => {
    render(<DriverStanding driver={plain} position={5} change={-3} />)
    expect(screen.getByText('5')).toHaveClass('bg-gray-100')
    expect(screen.getByText('↓3')).toHaveClass('text-red-500')
    expect(screen.queryByText('Points')).not.toBeInTheDocument()
  })

  test('no change shown when unchanged', () => {
    const { container } = render(<DriverStanding driver={plain} position={2} change={0} />)
    expect(container.textContent).not.toMatch(/[↑↓]/)
    expect(screen.getByText('2')).toHaveClass('bg-gray-300')
  })
})

describe('DriverSelectCard', () => {
  test('selected: a check mark; clicking toggles', async () => {
    const onToggle = vi.fn()
    const { container } = render(<DriverSelectCard driver={ana} selected onToggle={onToggle} />)
    expect(container.firstChild).toHaveClass('ring-blue-500')
    expect(container.querySelector('.bg-blue-500 svg')).not.toBeNull()
    expect(screen.getByText('7')).toHaveClass('text-4xl')
    expect(screen.getByText('GOLD')).toBeInTheDocument()
    await userEvent.click(screen.getByText('Ana Silva'))
    expect(onToggle).toHaveBeenCalledOnce()
  })

  test('not selected, with a picture and a three-digit number', () => {
    const { container } = render(
      <DriverSelectCard driver={{ ...plain, img: '/api/img/b.png', number: 321 }} onToggle={vi.fn()} />
    )
    expect(container.querySelector('.bg-blue-500')).toBeNull()
    expect(screen.getByAltText('Bo')).toBeInTheDocument()
    expect(screen.getByText('321')).toHaveClass('text-3xl')
  })
})
