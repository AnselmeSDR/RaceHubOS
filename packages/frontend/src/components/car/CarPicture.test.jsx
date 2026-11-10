import { render } from '@testing-library/react'
import CarPicture from './CarPicture'

describe('CarPicture', () => {
  test('the car comes whole and on its own: never cropped, nothing around it', () => {
    const { container } = render(
      <CarPicture car={{ brand: 'AMG', model: 'GT3 #8', img: '/api/img/cars/amg.png' }} className="w-16 h-10" />
    )
    const picture = container.firstChild
    expect(picture.tagName).toBe('IMG')
    expect(picture).toHaveAttribute('alt', 'AMG GT3 #8')
    expect(picture.getAttribute('src')).toMatch(/\/api\/img\/cars\/amg\.png$/)
    expect(picture).toHaveClass('object-contain', 'w-16', 'h-10')
    expect(picture).not.toHaveClass('object-cover')
  })

  test('next to the car name, the picture can stay silent', () => {
    const { container } = render(<CarPicture car={{ brand: 'AMG', model: 'GT3 #8', img: '/a.png' }} alt="" />)
    expect(container.firstChild).toHaveAttribute('alt', '')
  })
})
