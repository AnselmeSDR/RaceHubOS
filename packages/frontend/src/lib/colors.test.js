import { CARD, readableOn, tinted } from './colors'

test('a colour that reads on its background is kept; too close to it, it is pulled away, hue kept', () => {
  expect(readableOn('#e10600', CARD.dark)).toBe('#e10600')
  expect(readableOn('#e10600', CARD.light)).toBe('#e10600')
  // A navy and a dark grey on the dark card, a yellow on the white one
  expect(readableOn('#00007c', CARD.dark)).toBe('#6666b0')
  expect(readableOn('#3b3a38', CARD.dark)).toBe('#767574')
  expect(readableOn('#fff349', CARD.light)).toBe('#99922c')
  // Black and white, at the far end of each theme
  expect(readableOn('#000000', CARD.dark)).toBe('#808080')
  expect(readableOn('#ffffff', CARD.light)).toBe('#808080')
})

test('a colour that is not #rrggbb is left as it is', () => {
  for (const color of ['blue', '#FFF', null, 42]) expect(readableOn(color, CARD.dark)).toBe(color)
  expect(readableOn('#00007c', 'white')).toBe('#00007c')
})

test('a tint lays part of a colour over a background', () => {
  expect(tinted('#000000', '#ffffff', 0.5)).toBe('#808080')
  expect(tinted(CARD.dark, '#ff0000', 0)).toBe(CARD.dark)
  expect(tinted(CARD.dark, 'blue', 0.3)).toBe(CARD.dark)
})
