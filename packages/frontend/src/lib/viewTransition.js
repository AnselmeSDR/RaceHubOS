import { flushSync } from 'react-dom'

const PATIENCE = 500

/** The `view-transition-name` of a record's picture: the same on its line, its card and its profile. */
export const pictureName = (kind, id) => `${kind}-${String(id).replace(/[^a-zA-Z0-9_-]/g, '')}`

const carrying = (name) => document.querySelector(`[data-vt="${name}"]`)

/**
 * Resolves once an element other than `previous` carries the transition name `name`, or after
 * `PATIENCE` ms: the router renders the next page in a React transition, which `flushSync` does not
 * flush, and that page may load its record first.
 */
function appeared(name, previous) {
  const present = () => {
    const element = carrying(name)
    return element && element !== previous
  }
  return new Promise((resolve) => {
    if (present()) return resolve()
    const done = () => {
      observer.disconnect()
      clearTimeout(timer)
      resolve()
    }
    const observer = new MutationObserver(() => present() && done())
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-vt'] })
    const timer = setTimeout(done, PATIENCE)
  })
}

/**
 * Runs `update` as a view transition: what carries the same transition name before and after glides
 * from its old place to its new one (a picture from its line to the profile's header, a card to its
 * line). `until` names the picture to wait for when the new page loads its record first. A plain
 * update where the browser cannot, or when the system asks for reduced motion.
 */
export function withViewTransition(update, until) {
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (!document.startViewTransition || reduced) return update()
  const previous = until && carrying(until)
  document.startViewTransition(async () => {
    flushSync(update)
    if (until) await appeared(until, previous)
  })
}
