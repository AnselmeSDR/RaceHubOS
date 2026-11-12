import { useState } from 'react'

/**
 * The browser's own drag and drop: `source(item)` makes an element draggable, `target(id,
 * accepts, onDrop)` a place to drop on, which `over` names while something it accepts hovers it,
 * so that the place can show where the item would land. The innermost target that accepts wins.
 */
export function useDragAndDrop() {
  const [dragged, setDragged] = useState(null)
  const [over, setOver] = useState(null)
  const end = () => {
    setDragged(null)
    setOver(null)
  }
  const accepted = (accepts) => dragged !== null && accepts(dragged)

  return {
    dragged,
    over,
    source: (item) => ({
      draggable: true,
      onDragStart: (e) => {
        e.stopPropagation()
        // Firefox starts no drag without data
        e.dataTransfer?.setData('text/plain', '')
        setDragged(item)
      },
      onDragEnd: end,
    }),
    target: (id, accepts, onDrop) => ({
      onDragOver: (e) => {
        if (!accepted(accepts)) return
        e.preventDefault()
        e.stopPropagation()
        if (over !== id) setOver(id)
      },
      onDragLeave: (e) => {
        // Moving onto a child of the target is not leaving it
        if (!e.currentTarget.contains(e.relatedTarget)) setOver((current) => (current === id ? null : current))
      },
      onDrop: (e) => {
        if (!accepted(accepts)) return
        e.preventDefault()
        e.stopPropagation()
        end()
        onDrop(dragged)
      },
    }),
  }
}
