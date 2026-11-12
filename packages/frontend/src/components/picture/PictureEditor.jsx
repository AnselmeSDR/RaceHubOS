import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  containScale,
  DEFAULT_TOLERANCE,
  outputSide,
  placement,
  removeBackground,
  toleranceDistance,
} from '@/lib/picture'

// The stage, in CSS pixels at full width, and the square frame in its middle
const STAGE = { width: 520, height: 340 }
const FRAME = { side: 270, x: (520 - 270) / 2, y: (340 - 270) / 2 }
// Longest side of the copy the background is removed on
const WORK_MAX = 1536
const SWATCHES = ['#ffffff', '#f5f5f4', '#1c1917', '#000000']

function checkerPattern(ctx) {
  const tile = document.createElement('canvas')
  tile.width = tile.height = 16
  const t = tile.getContext('2d')
  t.fillStyle = '#ffffff'
  t.fillRect(0, 0, 16, 16)
  t.fillStyle = '#e2e2e2'
  t.fillRect(0, 0, 8, 8)
  t.fillRect(8, 8, 8, 8)
  return ctx.createPattern(tile, 'repeat')
}

/** The rounded square of the layer (corners at 20 % of the side, as `PictureLayer`). */
function layerPath(ctx, x, y, side) {
  ctx.beginPath()
  ctx.roundRect(x, y, side, side, side * 0.2)
}

const workContext = (canvas) => canvas.getContext('2d', { willReadFrequently: true })

/**
 * Frames a picture in the square of the layer before it is uploaded: zoom from 10 % (the whole picture,
 * the rest left to the background) to 300 %, a transparent or plain background, and the removal of a
 * plain background (from the edges, or the area clicked with the eraser). `onSave` receives the PNG.
 */
export default function PictureEditor({ src, color = '#3B82F6', onCancel, onSave }) {
  const { t } = useTranslation('common')
  const stageRef = useRef(null)
  const workRef = useRef(null)
  const originalRef = useRef(null)
  const dragRef = useRef(null)
  // The working copy's size once the picture is loaded
  const [size, setSize] = useState(null)
  const [failed, setFailed] = useState(false)
  const [framing, setFraming] = useState({ scale: 1, x: 0, y: 0 })
  const [background, setBackground] = useState(null)
  const [tolerance, setTolerance] = useState(DEFAULT_TOLERANCE)
  const [eraser, setEraser] = useState(false)
  const [history, setHistory] = useState([])
  const [message, setMessage] = useState(null)
  const [version, setVersion] = useState(0)

  // A working copy of the picture: the removals change it, the original stays for « Image d'origine »
  useEffect(() => {
    let alive = true
    const image = new Image()
    image.onload = () => {
      if (!alive) return
      const scale = Math.min(1, WORK_MAX / Math.max(image.naturalWidth, image.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      const ctx = workContext(canvas)
      if (!ctx) return setFailed(true)
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
      workRef.current = canvas
      originalRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)
      setFraming({ scale: containScale(canvas.width, canvas.height), x: 0, y: 0 })
      setSize({ width: canvas.width, height: canvas.height })
    }
    image.onerror = () => alive && setFailed(true)
    image.src = src
    return () => {
      alive = false
    }
  }, [src])

  useEffect(() => {
    const canvas = stageRef.current
    const work = workRef.current
    const ctx = canvas?.getContext('2d')
    if (!size || !ctx || !work) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = STAGE.width * dpr
    canvas.height = STAGE.height * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#292524'
    ctx.fillRect(0, 0, STAGE.width, STAGE.height)
    const p = placement(work.width, work.height, framing, FRAME.side)
    const draw = () => ctx.drawImage(work, FRAME.x + p.left, FRAME.y + p.top, p.width, p.height)
    // What falls outside the frame, dimmed
    ctx.globalAlpha = 0.28
    draw()
    ctx.globalAlpha = 1
    ctx.save()
    layerPath(ctx, FRAME.x, FRAME.y, FRAME.side)
    ctx.clip()
    ctx.fillStyle = background ?? checkerPattern(ctx)
    ctx.fillRect(FRAME.x, FRAME.y, FRAME.side, FRAME.side)
    draw()
    ctx.restore()
    // The editor's guide only: the layer has no border
    ctx.setLineDash([5, 4])
    ctx.lineWidth = 1.5
    ctx.strokeStyle = 'rgba(255,255,255,.7)'
    layerPath(ctx, FRAME.x, FRAME.y, FRAME.side)
    ctx.stroke()
  }, [size, framing, background, version])

  // The wheel zooms: a native listener, React's is passive and cannot stop the page from scrolling
  useEffect(() => {
    const canvas = stageRef.current
    if (!canvas) return
    const onWheel = (e) => {
      e.preventDefault()
      setFraming((f) => ({ ...f, scale: Math.min(3, Math.max(0.1, f.scale * Math.exp(-e.deltaY * 0.0015))) }))
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [size])

  const report = (share, action) => {
    if (share === null) {
      setMessage({
        warn: true,
        text: t(action.type === 'edges' ? 'pictureEditor.noPlainEdge' : 'pictureEditor.nothingHere'),
      })
    } else if (share < 0.01) {
      setMessage({ text: t('pictureEditor.removedLittle') })
    } else {
      setMessage({ text: t('pictureEditor.removed', { percent: Math.round(share * 100) }) })
    }
  }

  /** Runs `action` on the image data `from`, at `value`; writes the result only when something was removed. */
  const apply = (from, action, value) => {
    const work = workRef.current
    const data = new ImageData(new Uint8ClampedArray(from.data), work.width, work.height)
    const share = removeBackground(data.data, work.width, work.height, action, toleranceDistance(value))
    report(share, action)
    if (share !== null) workContext(work).putImageData(data, 0, 0)
    setVersion((v) => v + 1)
    return share
  }

  const remove = (action) => {
    const work = workRef.current
    if (!work) return
    const before = workContext(work).getImageData(0, 0, work.width, work.height)
    if (apply(before, action, tolerance) !== null) setHistory((h) => [...h, { before, action }])
  }

  // A new tolerance redoes the last removal from the image as it was before it
  const retune = (value) => {
    setTolerance(value)
    const last = history.at(-1)
    if (!last) return
    workContext(workRef.current).putImageData(last.before, 0, 0)
    apply(last.before, last.action, value)
  }

  const undo = () => {
    const last = history.at(-1)
    if (!last) return
    workContext(workRef.current).putImageData(last.before, 0, 0)
    setHistory((h) => h.slice(0, -1))
    setMessage(null)
    setVersion((v) => v + 1)
  }

  const restore = () => {
    workContext(workRef.current).putImageData(originalRef.current, 0, 0)
    setHistory([])
    setMessage(null)
    setVersion((v) => v + 1)
  }

  /** The pixel of the working copy under the pointer, or null outside the picture. */
  const pixelAt = (e) => {
    const work = workRef.current
    const rect = stageRef.current.getBoundingClientRect()
    const k = STAGE.width / rect.width
    const p = placement(work.width, work.height, framing, FRAME.side)
    const u = ((e.clientX - rect.left) * k - FRAME.x - p.left) / p.width
    const v = ((e.clientY - rect.top) * k - FRAME.y - p.top) / p.height
    if (u < 0 || u >= 1 || v < 0 || v >= 1) return null
    return Math.floor(v * work.height) * work.width + Math.floor(u * work.width)
  }

  const onPointerDown = (e) => {
    dragRef.current = { x: e.clientX, y: e.clientY, moved: 0 }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e) => {
    const drag = dragRef.current
    if (!drag) return
    const k = STAGE.width / e.currentTarget.getBoundingClientRect().width
    const dx = (e.clientX - drag.x) * k
    const dy = (e.clientY - drag.y) * k
    drag.moved += Math.abs(dx) + Math.abs(dy)
    drag.x = e.clientX
    drag.y = e.clientY
    setFraming((f) => ({ ...f, x: f.x + dx / FRAME.side, y: f.y + dy / FRAME.side }))
  }
  const onPointerUp = (e) => {
    const drag = dragRef.current
    dragRef.current = null
    if (!eraser || !drag || drag.moved >= 4) return
    const pixel = pixelAt(e)
    if (pixel !== null) remove({ type: 'point', pixel })
  }

  const fit = (whole) => {
    const work = workRef.current
    setFraming({ scale: whole ? containScale(work.width, work.height) : 1, x: 0, y: 0 })
  }

  const save = () => {
    const work = workRef.current
    const side = outputSide(work.width, work.height, framing.scale)
    const out = document.createElement('canvas')
    out.width = out.height = side
    const ctx = out.getContext('2d')
    if (background) {
      ctx.fillStyle = background
      ctx.fillRect(0, 0, side, side)
    }
    ctx.imageSmoothingQuality = 'high'
    const p = placement(work.width, work.height, framing, side)
    ctx.drawImage(work, p.left, p.top, p.width, p.height)
    out.toBlob((blob) => blob && onSave(blob), 'image/png')
  }

  const ready = size !== null
  const side = ready ? outputSide(size.width, size.height, framing.scale) : 0
  const zoom = Math.round(framing.scale * 100)
  const swatches = [color, ...SWATCHES.filter((c) => c !== color.toLowerCase())]

  return createPortal(
    <div
      data-testid="picture-editor"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="bg-card text-foreground border border-border rounded-xl shadow-xl w-full max-w-xl max-h-[95vh] overflow-y-auto p-5 flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-lg font-bold">{t('pictureEditor.title')}</h2>
          <span className="text-sm text-muted-foreground">{t('pictureEditor.hint')}</span>
        </div>

        {failed ? (
          <p className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">{t('pictureEditor.loadError')}</p>
        ) : (
          <canvas
            ref={stageRef}
            data-testid="picture-editor-stage"
            className={cn(
              'w-full aspect-[52/34] rounded-lg bg-stone-800 touch-none',
              eraser ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
            )}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          />
        )}

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="picture-zoom" className="text-sm font-semibold min-w-12">
            {t('pictureEditor.zoom')}
          </label>
          <input
            id="picture-zoom"
            type="range"
            min={10}
            max={300}
            value={zoom}
            disabled={!ready}
            onChange={(e) => setFraming((f) => ({ ...f, scale: Number(e.target.value) / 100 }))}
            className="flex-1 min-w-28 accent-primary"
          />
          <span className="w-12 text-right font-mono text-xs text-muted-foreground">{zoom} %</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!ready}
            title={t('pictureEditor.fitHint')}
            onClick={() => fit(true)}
          >
            {t('pictureEditor.fit')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!ready}
            title={t('pictureEditor.fillHint')}
            onClick={() => fit(false)}
          >
            {t('pictureEditor.fill')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!ready}
            onClick={() => setFraming((f) => ({ ...f, x: 0, y: 0 }))}
          >
            {t('pictureEditor.center')}
          </Button>
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold min-w-12">{t('pictureEditor.background')}</span>
            <div className="inline-flex rounded-lg bg-muted p-0.5">
              {[
                [false, t('pictureEditor.transparent')],
                [true, t('pictureEditor.plain')],
              ].map(([plain, label]) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={!!background === plain}
                  onClick={() => setBackground(plain ? (background ?? color) : null)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs',
                    !!background === plain ? 'bg-card font-semibold shadow-sm' : 'text-muted-foreground'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {swatches.map((c, i) => (
              <button
                key={c}
                type="button"
                title={i === 0 ? t('pictureEditor.recordColour') : c}
                aria-label={i === 0 ? t('pictureEditor.recordColour') : c}
                onClick={() => setBackground(c)}
                className={cn(
                  'relative size-6 rounded-md border border-black/15',
                  background === c && 'outline-2 outline-offset-2 outline-primary'
                )}
                style={{ backgroundColor: c }}
              >
                {i === 0 && (
                  <span className="absolute -right-1 -bottom-1 size-2.5 rounded-full border border-stone-400 bg-white" />
                )}
              </button>
            ))}
            <input
              type="color"
              title={t('pictureEditor.otherColour')}
              aria-label={t('pictureEditor.otherColour')}
              value={background ?? color}
              onChange={(e) => setBackground(e.target.value)}
              className="h-7 w-8 cursor-pointer rounded-md border border-border bg-card p-0.5"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!ready}
              title={t('pictureEditor.removeBackgroundHint')}
              onClick={() => remove({ type: 'edges' })}
            >
              {t('pictureEditor.removeBackground')}
            </Button>
            <Button
              type="button"
              variant={eraser ? 'secondary' : 'outline'}
              size="sm"
              disabled={!ready}
              aria-pressed={eraser}
              title={t('pictureEditor.eraserHint')}
              onClick={() => setEraser((on) => !on)}
            >
              {t('pictureEditor.eraser')}
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={!history.length} onClick={undo}>
              {t('pictureEditor.undo')}
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={!history.length} onClick={restore}>
              {t('pictureEditor.original')}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="picture-tolerance" className="text-sm font-semibold min-w-12">
              {t('pictureEditor.tolerance')}
            </label>
            <input
              id="picture-tolerance"
              type="range"
              min={0}
              max={100}
              value={tolerance}
              disabled={!ready}
              onChange={(e) => retune(Number(e.target.value))}
              className="flex-1 min-w-28 accent-primary"
            />
            <span className="w-12 text-right font-mono text-xs text-muted-foreground">{tolerance}</span>
          </div>
          {message && (
            <p
              className={cn('text-xs', message.warn ? 'text-orange-700 dark:text-orange-300' : 'text-muted-foreground')}
            >
              {message.text}
            </p>
          )}
        </div>

        {ready && (
          <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {background
              ? t('pictureEditor.outputPlain', { side, colour: background })
              : t('pictureEditor.outputTransparent', { side })}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t('cancel')}
          </Button>
          <Button type="button" disabled={!ready} onClick={save}>
            {t('pictureEditor.save')}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
