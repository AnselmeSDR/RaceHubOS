import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tabs, TabsList, TabsTrigger } from './tabs'

// jsdom lays nothing out: each tab is 80px wide, one after the other
const PLACES = { Grid: 0, List: 80, Map: 160 }
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function () {
    return PLACES[this.textContent] ?? 0
  })
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(80)
})
afterEach(() => vi.restoreAllMocks())

const pill = () => document.querySelector('[data-slot="tabs-pill"]')

test('the pill sits under the picked tab and glides to the next one picked', async () => {
  render(
    <Tabs defaultValue="grid">
      <TabsList>
        <TabsTrigger value="grid">Grid</TabsTrigger>
        <TabsTrigger value="list">List</TabsTrigger>
        <TabsTrigger value="map">Map</TabsTrigger>
      </TabsList>
    </Tabs>
  )
  expect(pill()).toHaveStyle({ width: '80px', transform: 'translateX(0px)' })
  // It moves rather than being redrawn: one element, with a transition, cut with reduced motion
  expect(pill()).toHaveClass('transition-[transform,width]', 'motion-reduce:transition-none')

  await userEvent.click(screen.getByRole('tab', { name: 'Map' }))
  await act(async () => {})
  expect(pill()).toHaveStyle({ transform: 'translateX(160px)' })
  expect(screen.getByRole('tab', { name: 'Map' })).toHaveAttribute('aria-selected', 'true')
})

test('underlined tabs keep their line: no pill', () => {
  render(
    <Tabs defaultValue="grid">
      <TabsList variant="line">
        <TabsTrigger value="grid">Grid</TabsTrigger>
      </TabsList>
    </Tabs>
  )
  expect(pill()).toBeNull()
})
