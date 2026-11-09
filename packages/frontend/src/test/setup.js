import '@testing-library/jest-dom/vitest'

// Radix primitives (Select…) call pointer-capture and scroll APIs that jsdom lacks (none in the node environment)
if (typeof Element !== 'undefined') {
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.setPointerCapture ??= () => {}
  Element.prototype.releasePointerCapture ??= () => {}
  Element.prototype.scrollIntoView ??= () => {}
}
