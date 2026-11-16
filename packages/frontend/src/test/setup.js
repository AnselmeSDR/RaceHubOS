import '@testing-library/jest-dom/vitest'
import { MotionGlobalConfig } from 'framer-motion'

// Animations end at once: a window or a step that leaves is gone when the test looks
MotionGlobalConfig.skipAnimations = true

// Browser APIs jsdom lacks (none of this in the node environment): pointer capture and scrolling
// for Radix primitives (Select…), IntersectionObserver for the tables' infinite scroll
if (typeof Element !== 'undefined') {
  globalThis.IntersectionObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.setPointerCapture ??= () => {}
  Element.prototype.releasePointerCapture ??= () => {}
  Element.prototype.scrollIntoView ??= () => {}
}
