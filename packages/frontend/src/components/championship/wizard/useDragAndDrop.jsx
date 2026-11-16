import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { animate, motion, useMotionValue, useReducedMotion } from 'framer-motion'

const THRESHOLD = 4 // px moved before a press becomes a drag: a click stays a click
const LIFT = { type: 'spring', bounce: 0, duration: 0.25 }
const HOME = { type: 'spring', bounce: 0, duration: 0.35 }
const LAND = { type: 'spring', bounce: 0.15, duration: 0.35 } // a throw carries momentum: a little bounce
const EDGE = 40 // px from the edge of a scrolling box where a drag scrolls it
const SPEED = 12 // px per frame

// A refused place shakes once: a spring set off sideways (700 px/s, damping 0.25, response 0.18 s)
const SHAKE = (() => {
  const omega = (2 * Math.PI) / 0.18
  const zeta = 0.25
  const damped = omega * Math.sqrt(1 - zeta * zeta)
  const frames = []
  for (let t = 0; t < 0.6; t += 1 / 60) {
    const offset = (700 / damped) * Math.exp(-zeta * omega * t) * Math.sin(damped * t)
    frames.push({ transform: `translateX(${offset.toFixed(2)}px)` })
  }
  return [...frames, { transform: 'none' }]
})()

const sourceAt = (key) => key && document.querySelector(`[data-drag-key="${key}"]`)

/**
 * Drag and drop with the pointer: mouse, touch and pen. `source(item, key, preview)` makes an element
 * draggable: pressed and moved, `preview` lifts and follows the pointer where it was grabbed.
 * `target(id, accepts, onDrop)` is a place to drop on, which `over` names while something it accepts
 * hovers it; the innermost target that accepts wins. `onDrop(item)` returns false when it refuses (the
 * item springs back home, the place shakes), else the key of the source where the item now lies, which
 * it flies to at the speed it was released (nothing: it fades). In flight it can be caught again.
 * `lifted` keys the source shown as a gap meanwhile. Render `overlay` once.
 */
export function useDragAndDrop() {
  const [dragged, setDragged] = useState(null)
  const [over, setOver] = useState(null)
  const [lifted, setLifted] = useState(null)
  const [flight, setFlight] = useState(null) // { base, preview, catchable }
  const reduced = useReducedMotion()
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const scale = useMotionValue(1)
  const opacity = useMotionValue(1)
  // This render's places and sources, read by the gesture once committed: a ref callback would keep
  // the first ones (framer-motion keeps the first ref of a motion element)
  const scope = useId()
  const places = {}
  const sources = {}
  const latest = useRef({ places, sources })
  useLayoutEffect(() => {
    latest.current = { places, sources }
  })
  const gesture = useRef(null)
  const flown = useRef(null) // the flight under way: { key, controls }
  const base = useRef(null) // where the preview stands before it moves

  useEffect(() => () => gesture.current?.stop(), [])

  // The innermost place under the pointer that accepts the item
  function hitAt(e, item) {
    const under = document.elementFromPoint?.(e.clientX, e.clientY) ?? e.target
    for (let el = under?.closest?.('[data-drop-id]'); el; el = el.parentElement?.closest('[data-drop-id]')) {
      const place = latest.current.places[el.dataset.dropId]
      if (place?.accepts(item)) return { el, ...place }
    }
    return null
  }

  function settle() {
    flown.current = null
    setFlight(null)
    setLifted(null)
    x.jump(0)
    y.jump(0)
    scale.jump(1)
    opacity.jump(1)
  }

  function follow(g, e) {
    g.point = { x: e.clientX, y: e.clientY }
    x.set(e.clientX - g.grab.x - g.base.left)
    y.set(e.clientY - g.grab.y - g.base.top)
    g.hit = hitAt(e, g.item)
    setOver(g.hit?.id ?? null)
  }

  // Near the edge of a box that scrolls, the drag scrolls it, the place under the pointer following
  function scrollEdges(g) {
    if (gesture.current !== g || !g.point || !document.elementFromPoint) return
    const { x: px, y: py } = g.point
    for (let el = document.elementFromPoint(px, py); el; el = el.parentElement) {
      const style = getComputedStyle(el)
      const box = el.getBoundingClientRect()
      if (/auto|scroll/.test(style.overflowY) && el.scrollHeight > el.clientHeight) {
        if (py < box.top + EDGE) el.scrollTop -= SPEED
        else if (py > box.bottom - EDGE) el.scrollTop += SPEED
      }
      if (/auto|scroll/.test(style.overflowX) && el.scrollWidth > el.clientWidth) {
        if (px < box.left + EDGE) el.scrollLeft -= SPEED
        else if (px > box.right - EDGE) el.scrollLeft += SPEED
      }
    }
    follow(g, { clientX: px, clientY: py })
    g.frame = requestAnimationFrame(() => scrollEdges(g))
  }

  function lift(g) {
    g.started = true
    base.current = g.base
    setFlight({ base: g.base, preview: g.preview, catchable: false })
    setDragged(g.item)
    setLifted(g.key)
    if (!reduced) animate(scale, 1.04, LIFT)
    g.frame = requestAnimationFrame(() => scrollEdges(g))
  }

  function fly(key, transition) {
    const el = sourceAt(key)
    if (!el || reduced) return settle()
    const to = el.getBoundingClientRect()
    setFlight((f) => f && { ...f, catchable: true })
    // From where it was let go, at the speed it was let go (the motion values know it)
    const controls = [
      animate(x, to.left - base.current.left, transition),
      animate(y, to.top - base.current.top, transition),
      animate(scale, 1, transition),
    ]
    const current = { key, controls }
    flown.current = current
    Promise.all(controls).then(() => flown.current === current && settle())
  }

  function release(e) {
    const g = gesture.current
    g.stop()
    if (!g.started) return
    const hit = e && hitAt(e, g.item)
    let result = false
    flushSync(() => {
      setDragged(null)
      setOver(null)
      if (hit) result = hit.onDrop(g.item)
      setLifted(result === false ? g.key : (result ?? null))
    })
    if (result === undefined) {
      const fading = { key: null, controls: [animate(opacity, 0, { duration: reduced ? 0 : 0.15 })] }
      flown.current = fading
      return fading.controls[0].then(() => flown.current === fading && settle())
    }
    if (hit && result === false && !reduced) hit.el.animate?.(SHAKE, { duration: 600, easing: 'linear' })
    fly(result === false ? g.key : result, result === false ? HOME : LAND)
  }

  function start(g) {
    const move = (e) => {
      if (!g.started) {
        if (Math.hypot(e.clientX - g.from.x, e.clientY - g.from.y) < THRESHOLD) return
        lift(g)
      }
      follow(g, e)
    }
    const up = (e) => release(e)
    const cancel = () => release(null)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    g.stop = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      cancelAnimationFrame(g.frame)
      gesture.current = null
    }
    gesture.current = g
  }

  function press(e, item, key, preview) {
    // A button inside the source keeps its click
    if (e.button !== 0 || gesture.current || e.target.closest?.('button, a, input, select, textarea')) return
    if (flown.current) {
      flown.current.controls.forEach((c) => c.stop())
      settle()
    }
    const rect = e.currentTarget.getBoundingClientRect()
    start({
      item,
      key,
      preview,
      base: rect,
      from: { x: e.clientX, y: e.clientY },
      grab: { x: e.clientX - rect.left, y: e.clientY - rect.top },
      started: false,
    })
  }

  // Caught in flight: the drag goes on from where it is, the item where it now lies
  function catchFlight(e) {
    const f = flown.current
    const source = f && latest.current.sources[f.key]
    if (e.button !== 0 || gesture.current || !source) return
    f.controls.forEach((c) => c.stop())
    flown.current = null
    const left = base.current.left + x.get()
    const top = base.current.top + y.get()
    const g = {
      item: source.item,
      key: f.key,
      preview: source.preview,
      base: base.current,
      from: { x: e.clientX, y: e.clientY },
      grab: { x: e.clientX - left, y: e.clientY - top },
    }
    start(g)
    lift(g)
  }

  const overlay =
    flight &&
    createPortal(
      <motion.div
        aria-hidden="true"
        data-testid="wizard-drag-overlay"
        onPointerDown={catchFlight}
        className="fixed z-60 rounded-md shadow-xl cursor-grabbing touch-none select-none"
        style={{
          left: flight.base.left,
          top: flight.base.top,
          width: flight.base.width,
          x,
          y,
          scale,
          opacity,
          pointerEvents: flight.catchable ? 'auto' : 'none',
        }}
      >
        {flight.preview}
      </motion.div>,
      document.body
    )

  return {
    dragged,
    over,
    lifted,
    overlay,
    source: (item, key, preview) => {
      sources[key] = { item, preview }
      return {
        'data-drag-key': key,
        onPointerDown: (e) => press(e, item, key, preview),
        // An image inside starts no drag of its own
        onDragStart: (e) => e.preventDefault(),
      }
    },
    target: (id, accepts, onDrop) => {
      // Scoped: another list's places are not this one's
      places[`${scope}${id}`] = { id, accepts, onDrop }
      return { 'data-drop-id': `${scope}${id}` }
    },
  }
}
