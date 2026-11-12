import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import DriverAvatar from '@/components/driver/DriverAvatar'
import CarPicture from '@/components/car/CarPicture'
import TrackPicture from '@/components/track/TrackPicture'
import DivisionLogo from '@/components/division/DivisionLogo'
import PhotoUploadField from '@/components/crud/PhotoUploadField'

// The editor needs a canvas: here it hands back a PNG as soon as it opens, and shows what it was given
vi.mock('@/components/picture/PictureEditor', () => ({
  default: ({ src, color, onSave }) => (
    <button
      type="button"
      data-testid="picture-editor"
      data-src={src}
      data-color={color}
      onClick={() => onSave(new Blob(['png'], { type: 'image/png' }))}
    >
      save
    </button>
  ),
}))

beforeAll(() => i18n.changeLanguage('en'))
afterEach(() => vi.unstubAllGlobals())

describe('the picture layer', () => {
  test('one rounded square for every kind, without ring or shadow', () => {
    const { container } = render(
      <>
        <DriverAvatar driver={{ name: 'Ana', img: '/api/img/drivers/ana.png' }} />
        <CarPicture car={{ brand: 'AMG', model: 'GT3', img: '/api/img/cars/amg.png' }} />
        <TrackPicture track={{ name: 'Monza', img: '/api/img/tracks/monza.png' }} />
        <DivisionLogo division={{ name: 'GOLD', img: '/api/img/divisions/gold.png' }} />
      </>
    )
    const layers = [...container.children]
    expect(layers).toHaveLength(4)
    for (const layer of layers) {
      expect(layer).toHaveClass('rounded-[20%]', 'overflow-hidden')
      expect(layer.className).not.toMatch(/\b(ring|shadow|rounded-full)/)
      expect(layer.style.backgroundColor).toBe('')
      expect(layer.querySelector('img')).toBeInTheDocument()
    }
  })

  test('a car is shown whole, a driver fills the square', () => {
    render(
      <>
        <CarPicture car={{ brand: 'AMG', model: 'GT3 #8', img: '/a.png' }} />
        <DriverAvatar driver={{ name: 'Ana', img: '/b.png' }} alt="Ana" />
      </>
    )
    expect(screen.getByAltText('AMG GT3 #8')).toHaveClass('object-contain')
    expect(screen.getByAltText('Ana')).toHaveClass('object-cover')
  })

  test('without a picture, the colour of the record fills the layer', () => {
    const { container } = render(
      <>
        <DriverAvatar driver={{ name: 'Ana', color: '#ff0000' }} className="size-12" />
        <DriverAvatar driver={{ name: 'Zoé' }} />
        <CarPicture car={{ brand: 'Ferrari', model: '499P', color: '#00ff00' }} />
        <TrackPicture track={{ name: 'Monza', color: '#0000ff' }} />
      </>
    )
    const [ana, zoe, car, track] = container.children
    expect(ana).toHaveStyle({ backgroundColor: '#ff0000' })
    expect(ana).toHaveClass('size-12')
    expect(ana).toHaveTextContent('A')
    expect(zoe).toHaveStyle({ backgroundColor: '#3B82F6' })
    expect(car).toHaveStyle({ backgroundColor: '#00ff00' })
    expect(car).toHaveTextContent('F')
    expect(track).toHaveStyle({ backgroundColor: '#0000ff' })
    expect(track.querySelector('svg')).toBeInTheDocument()
  })

  test('a long division name gets a smaller text to fit whole in the layer', () => {
    render(
      <>
        <DivisionLogo division={{ name: 'GT3' }} />
        <DivisionLogo division={{ name: 'Classique' }} />
      </>
    )
    const size = (text) => parseFloat(screen.getByText(text).style.fontSize)
    expect(size('Classique')).toBeLessThan(size('GT3'))
    expect(size('Classique') * 'Classique'.length).toBeLessThanOrEqual(115)
  })

  test('a driver without a picture can show a label, such as their number', () => {
    render(<DriverAvatar driver={{ name: 'Ana', number: 171 }} label={171} />)
    expect(screen.getByText('171')).toBeInTheDocument()
    expect(screen.queryByText('A')).not.toBeInTheDocument()
  })
})

describe('PhotoUploadField', () => {
  test('the framed picture is uploaded as a PNG and becomes the value', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async () => ({
      json: async () => ({ success: true, data: { url: '/api/img/cars/new.png' } }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    const onChange = vi.fn()
    render(<PhotoUploadField value="/api/img/cars/old.png" onChange={onChange} uploadType="cars" color="#22c55e" />)

    // « Reframe » opens the editor on the current picture, with the record's colour to offer
    await user.click(screen.getByRole('button', { name: 'Reframe' }))
    const editor = screen.getByTestId('picture-editor')
    expect(editor).toHaveAttribute('data-src', '/api/img/cars/old.png')
    expect(editor).toHaveAttribute('data-color', '#22c55e')

    await user.click(editor)
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('/api/img/cars/new.png'))
    const [url, { body }] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/api\/upload\/cars$/)
    const file = body.get('img')
    expect(file.name).toBe('image.png')
    expect(file.type).toBe('image/png')
    expect(screen.queryByTestId('picture-editor')).not.toBeInTheDocument()
  })

  test('without a picture there is nothing to reframe', () => {
    render(<PhotoUploadField value="" onChange={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Reframe' })).not.toBeInTheDocument()
  })
})
