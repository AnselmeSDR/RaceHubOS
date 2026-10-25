import { tx, useExtensions, locale } from '../../i18n/raceScreens'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSession } from '../../context/SessionContext'
import { useDevice } from '../../context/DeviceContext'
import { fuelTelemetry } from '../../lib/fuelTelemetry.mjs'
import {
  defaultScreen,
  normalizeScreen,
  screenGap,
  screenFields,
  screenTime as formatScreenTime,
  shouldOpenScreen,
  startLights,
} from '../../lib/raceScreen.mjs'
import { getImgUrl } from '../../utils/image'
import { useTrackExtras } from './useTrackExtras'
import { loadScreen } from '../../lib/raceScreenStorage.mjs'
import { pitPlan } from '../../lib/pitPlan.mjs'

const screenTime = (value) => formatScreenTime(value, locale())
const statuses = {
  draft: 'Vorbereitet',
  active: 'Rennen läuft',
  paused: 'Pause',
  finishing: 'Zieleinlauf',
  finished: 'Beendet',
}
function demoEntries(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `demo-${i}`,
    controller: i,
    position: i + 1,
    driver: {
      name: tx('Testfahrer {{v0}}', { v0: i + 1 }),
      number: i + 11,
      color: ['#38bdf8', '#f97316', '#a78bfa', '#34d399', '#f472b6', '#facc15'][i],
      team: { name: tx('Testteam') },
    },
    car: { brand: 'Carrera', model: tx('Testauto {{v0}}', { v0: i + 1 }) },
    stats: {
      laps: 12 - i,
      bestLap: 8234 + i * 133,
      lastLap: 8456 + i * 222,
      totalTime: 108000,
      gap: { type: 'time', value: i * 850 },
    },
  }))
}

function Field({ id, config, selected, edit, children, label = true, fontScale = 1 }) {
  useExtensions()
  const b = config.widgets[id]
  const drag = useRef(null)
  if (!b.visible) return null
  function pointerDown(event, resize = false) {
    if (!edit) return
    event.stopPropagation()
    event.preventDefault()
    const rect = event.currentTarget.closest('[data-field]')?.parentElement.getBoundingClientRect()
    if (!rect) return
    drag.current = { x: event.clientX, y: event.clientY, box: { ...b }, rect, resize }
    event.currentTarget.setPointerCapture(event.pointerId)
    edit(id)
  }
  function pointerMove(event) {
    const d = drag.current
    if (!d) return
    const dx = ((event.clientX - d.x) / d.rect.width) * 100,
      dy = ((event.clientY - d.y) / d.rect.height) * 100
    edit(id, d.resize ? { w: d.box.w + dx, h: d.box.h + dy } : { x: d.box.x + dx, y: d.box.y + dy })
  }
  const events = {
    onPointerMove: pointerMove,
    onPointerUp: () => {
      drag.current = null
    },
    onPointerCancel: () => {
      drag.current = null
    },
  }
  return (
    <div
      data-testid={`race-widget-${id}`}
      data-field={id}
      onPointerDown={(e) => pointerDown(e)}
      {...events}
      style={{
        position: 'absolute',
        left: `${b.x}%`,
        top: `${b.y}%`,
        width: `${b.w}%`,
        height: `${b.h}%`,
        fontSize: `${(b.font * fontScale) / 19.2}cqw`,
        overflow: 'hidden',
        outline: edit ? `1px ${selected === id ? 'solid #facc15' : 'dashed #64748b'}` : undefined,
        cursor: edit ? 'move' : undefined,
        touchAction: edit ? 'none' : undefined,
        color: b.customColors ? b.color : undefined,
        background: b.customColors ? b.background : undefined,
        zIndex: edit && selected === id ? 40 : id === 'lights' ? 30 : id === 'rows' ? 0 : 1,
      }}
    >
      {label && <div style={{ fontSize: '.45em', opacity: 0.65, whiteSpace: 'nowrap' }}>{tx(screenFields[id])}</div>}
      <div
        style={{
          height: label ? '75%' : '100%',
          width: '100%',
          fontWeight: 700,
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
      {edit && selected === id && (
        <span
          data-testid={`race-resize-${id}`}
          aria-label={tx('Größe ändern: {{v0}}', { v0: tx(screenFields[id]) })}
          onPointerDown={(e) => pointerDown(e, true)}
          {...events}
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 14,
            height: 14,
            background: '#facc15',
            cursor: 'nwse-resize',
            touchAction: 'none',
          }}
        />
      )}
    </div>
  )
}

function DriverRow({ entry, leader, sessionType, index, config, selected, edit, device, demo, count }) {
  useExtensions()
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const fuel = fuelTelemetry({
    connected: device.connected,
    socketConnected: device.socketConnected,
    status: device.cuStatus,
    receivedAt: device.lastStatusAt,
    now,
    controller: entry.controller,
  })
  const raw = demo ? 14 - index : fuel.enabled ? fuel.raw : null
  const gap = screenGap(entry, leader, sessionType)
  const gapText =
    index === 0
      ? tx('Führend')
      : gap?.type === 'laps'
        ? tx('+{{v0}} Runden', { v0: gap.value })
        : gap?.type === 'time'
          ? `+${screenTime(gap.value)}`
          : typeof gap === 'number'
            ? `+${screenTime(gap)}`
            : typeof gap === 'string'
              ? gap
              : '—'
  const sections = demo ? { sector1: 4123, sector2: 4333, completed: true } : entry.stats?.sectors
  const values = {
    sectors: `${sections?.completed ? tx('Letzte') : tx('Aktuell')}: ${screenTime(sections?.sector1)} / ${screenTime(sections?.sector2)}${sections?.sector3 != null ? ' / ' + screenTime(sections.sector3) : ''}`,
    position: entry.position || index + 1,
    photo: entry.driver?.img ? (
      <img src={getImgUrl(entry.driver.img)} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    ) : (
      <span style={{ color: entry.driver?.color }}>{entry.driver?.name?.charAt(0) || '?'}</span>
    ),
    name: entry.driver?.name || tx('Unbekannter Fahrer'),
    number: entry.driver?.number || '—',
    team: entry.driver?.team?.name || '—',
    controller: Number.isInteger(entry.controller) ? entry.controller + 1 : '—',
    car: [entry.car?.brand, entry.car?.model].filter(Boolean).join(' ') || '—',
    laps: entry.stats?.laps ?? 0,
    best: screenTime(entry.stats?.bestLap),
    last: screenTime(entry.stats?.lastLap),
    total: screenTime(entry.stats?.totalTime),
    gap: gapText,
    fuel: (
      <>
        <span>{raw == null ? '—' : `${raw}/15`}</span>
        {raw != null && (
          <div style={{ height: 5, width: '95%', background: '#334155' }}>
            <div
              style={{ width: `${(raw / 15) * 100}%`, height: '100%', background: raw <= 3 ? '#f87171' : '#4ade80' }}
            />
          </div>
        )}
      </>
    ),
    pit: demo
      ? tx('Strecke')
      : !fuel.available
        ? '—'
        : !fuel.enabled
          ? 'FUEL OFF'
          : fuel.inPit
            ? tx('Box')
            : tx('Strecke'),
    dnf: entry.isDNF ? tx('Ausgeschieden') : '—',
  }
  return (
    <div
      data-testid={`race-driver-row-${index + 1}`}
      onPointerDown={(event) => {
        if (demo && index > 0) event.stopPropagation()
      }}
      aria-label={
        edit && index === 0
          ? tx('Erste Fahrerzeile – Vorlage für alle Fahrer')
          : tx('Fahrerzeile {{v0}}', { v0: index + 1 })
      }
      style={{
        position: 'relative',
        height: '100%',
        background: config.rowBackground,
        borderLeft: `4px solid ${entry.driver?.color || '#38bdf8'}`,
        borderRadius: 6,
        outline: edit && index === 0 ? '2px solid #facc15' : undefined,
      }}
    >
      {Object.keys(values).map((id) => (
        <Field
          key={id}
          id={id}
          config={config}
          selected={selected}
          edit={edit}
          fontScale={Math.min(1.8, Math.sqrt(6 / count))}
          label={!['photo', 'name', 'position'].includes(id)}
        >
          {values[id]}
        </Field>
      ))}
    </div>
  )
}

export function RaceCanvas({ config, selected, edit, demoCount, demoStart = 0 }) {
  useExtensions()
  const { session, entries, elapsed, remaining } = useSession()
  const device = useDevice()
  const extras = useTrackExtras()
  const demo = Boolean(demoCount)
  const drivers = demo ? demoEntries(demoCount) : entries.slice(0, 6)
  const lights = startLights(demo ? demoStart : device.cuStatus?.start, demo || device.connectionState === 'live')
  const values = {
    pitPlan: demo
      ? tx('2 Tankplätze · 1 Auto in Boxengasse · Tankreihenfolge: Testfahrer 2 (3/15)')
      : pitPlan(drivers, device, { ...extras, translate: tx }) || tx('Boxenplan ausgeschaltet'),
    title: demo ? tx('Beispielrennen · Vorschau') : session?.name || tx('Keine Sitzung ausgewählt'),
    track: demo ? tx('Testbahn') : session?.track?.name || '—',
    status: demo ? tx('Rennen läuft') : tx(statuses[session?.status]) || tx('Bereit'),
    elapsed: screenTime(demo ? 108000 : elapsed * 1000),
    remaining: screenTime(demo ? 72000 : remaining == null ? null : remaining * 1000),
    limit: demo
      ? tx('12 / 30 Runden')
      : session?.maxLaps
        ? `${Math.max(0, ...drivers.map((d) => d.stats?.laps || 0))} / ${session.maxLaps}`
        : tx('Ohne Rundenziel'),
    connection: demo
      ? tx('CU live · FUEL ON (Beispiel)')
      : device.connectionState === 'live'
        ? `CU live · FUEL ${device.cuStatus?.mode & 1 ? 'ON' : 'OFF'}`
        : device.connectionState === 'stale'
          ? tx('CU-Daten veraltet')
          : tx('Keine aktuellen CU-Daten'),
  }
  return (
    <div
      data-testid="race-screen-canvas"
      role="img"
      aria-label={tx('Rennbildschirm{{v0}}', { v0: demo ? tx(' Vorschau für {{v0}} Fahrer', { v0: demoCount }) : '' })}
      style={{
        containerType: 'inline-size',
        position: 'relative',
        width: '100%',
        aspectRatio: '16 / 9',
        background: config.background,
        color: config.textColor,
        overflow: 'hidden',
      }}
    >
      {Object.entries(values).map(([id, value]) => (
        <Field key={id} id={id} config={config} selected={selected} edit={edit}>
          {value}
        </Field>
      ))}
      {(lights.visible || (edit && selected === 'lights')) && (
        <Field id="lights" config={config} selected={selected} edit={edit} label={false}>
          <div
            style={{
              height: '100%',
              background: config.widgets.lights.customColors ? config.widgets.lights.background : '#000e',
              borderRadius: 16,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8%',
            }}
          >
            <div
              role="status"
              style={{
                fontSize: '.55em',
                color: lights.go
                  ? '#4ade80'
                  : lights.falseStart
                    ? '#f87171'
                    : config.widgets.lights.customColors
                      ? config.widgets.lights.color
                      : '#fff',
              }}
            >
              {lights.go ? tx('START!') : lights.falseStart ? tx('FEHLSTART') : tx('Startampel')}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '3%', width: '90%' }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <span
                  key={n}
                  style={{
                    width: '14%',
                    aspectRatio: '1',
                    borderRadius: '50%',
                    background: lights.go
                      ? '#22c55e'
                      : n <= (lights.visible ? lights.count : 5)
                        ? '#ef4444'
                        : '#302020',
                    boxShadow: n <= lights.count ? '0 0 20px #ef444488' : undefined,
                  }}
                />
              ))}
            </div>
          </div>
        </Field>
      )}
      <Field id="rows" config={config} selected={selected} edit={edit} label={false}>
        <div
          style={{
            display: 'grid',
            gridTemplateRows: `repeat(${Math.max(1, drivers.length)}, minmax(0, 1fr))`,
            gap: '1%',
            height: '100%',
          }}
        >
          {drivers.length ? (
            drivers.map((entry, index) => (
              <DriverRow
                key={entry.id || entry.controller || index}
                count={drivers.length}
                leader={drivers[0]}
                sessionType={session?.type}
                {...{ entry, index, config, selected, device, demo }}
                edit={index === 0 ? edit : undefined}
              />
            ))
          ) : (
            <div style={{ padding: 20 }}>{tx('Keine Fahrer in dieser Sitzung.')}</div>
          )}
        </div>
      </Field>
    </div>
  )
}

export default function RaceScreenHost() {
  useExtensions()
  const { session } = useSession()
  const [config, setConfig] = useState(() => normalizeScreen(defaultScreen))
  const [view, setView] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [notice, setNotice] = useState('')
  const [demoStart, setDemoStart] = useState(0)
  const closeButton = useRef(null)
  const previous = useRef(null),
    hadFullscreen = useRef(false),
    requestedFullscreen = useRef(false),
    viewRef = useRef(view)
  const settings = useRef(config)
  useLayoutEffect(() => {
    viewRef.current = view
    settings.current = config
  }, [view, config])
  const fullscreen = useCallback((enabled = settings.current.fullscreen) => {
    if (document.fullscreenElement || !enabled) return
    if (!document.documentElement.requestFullscreen) {
      setNotice(tx('Vollbild wird hier nicht unterstützt. Die große Ansicht bleibt nutzbar.'))
      return
    }
    requestedFullscreen.current = true
    document.documentElement.requestFullscreen().catch(() => {
      requestedFullscreen.current = false
      setNotice(tx('Für Vollbild bitte „Vollbild einschalten“ drücken.'))
    })
  }, [])
  const close = useCallback(() => {
    setView(null)
    setNotice('')
    if (requestedFullscreen.current && document.fullscreenElement) document.exitFullscreen().catch(() => {})
    requestedFullscreen.current = false
  }, [])
  useEffect(() => {
    const load = () => {
      loadScreen()
        .then(setConfig)
        .catch(() => {})
        .finally(() => setLoaded(true))
    }
    load()
    const prepare = () => {
      if (settings.current.autoOpen) fullscreen()
    }
    const failed = () => {
      if (!viewRef.current && requestedFullscreen.current && document.fullscreenElement)
        document.exitFullscreen().catch(() => {})
      requestedFullscreen.current = false
    }
    const preview = (event) => {
      setDemoStart(event.detail.lights ? 1 : 0)
      setView({ demoCount: event.detail.count, config: event.detail.config, lights: event.detail.lights })
      fullscreen(event.detail.config.fullscreen)
    }
    const change = () => {
      if (document.fullscreenElement) hadFullscreen.current = true
      else if (hadFullscreen.current) {
        hadFullscreen.current = false
        setView(null)
      }
    }
    const key = (event) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('race:layout-saved', load)
    window.addEventListener('race:screen-prepare', prepare)
    window.addEventListener('race:screen-failed', failed)
    window.addEventListener('race:screen-preview', preview)
    document.addEventListener('fullscreenchange', change)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('race:layout-saved', load)
      window.removeEventListener('race:screen-prepare', prepare)
      window.removeEventListener('race:screen-failed', failed)
      window.removeEventListener('race:screen-preview', preview)
      document.removeEventListener('fullscreenchange', change)
      window.removeEventListener('keydown', key)
    }
  }, [close, fullscreen])
  useEffect(() => {
    if (!loaded) return
    if (shouldOpenScreen(previous.current, session, config)) {
      setView({})
      fullscreen()
    }
    previous.current = session ? { id: session.id, status: session.status } : null
  }, [session, config, loaded, fullscreen])
  const isOpen = Boolean(view)
  useEffect(() => {
    if (!isOpen) return
    const root = document.getElementById('root')
    const focused = document.activeElement
    if (root) root.inert = true
    closeButton.current?.focus()
    return () => {
      if (root) root.inert = false
      if (focused?.isConnected) focused.focus?.()
    }
  }, [isOpen])
  useEffect(() => {
    if (!view?.lights) return
    const sequence = [1, 2, 3, 4, 5, 6, 7, 0]
    let index = 0
    const timer = setInterval(() => {
      index++
      setDemoStart(sequence[index] ?? 0)
      if (index >= sequence.length - 1) clearInterval(timer)
    }, 900)
    return () => clearInterval(timer)
  }, [view])
  if (!view) return null
  return createPortal(
    <section
      data-testid="race-screen-dialog"
      role="dialog"
      aria-label={tx('Rennbildschirm')}
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#030712',
        display: 'flex',
        flexDirection: 'column',
        color: 'white',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          padding: '8px 16px',
          minHeight: 44,
          flexShrink: 0,
          background: '#111827',
        }}
      >
        <span>{view.demoCount ? tx('Vorschau · Beispieldaten') : tx('Rennbildschirm')}</span>
        {notice && <span role="status">{notice}</span>}
        <button className="underline ml-auto" onClick={() => fullscreen(true)}>
          {tx('Vollbild einschalten')}
        </button>
        <button ref={closeButton} className="border rounded px-3 py-1" onClick={close}>
          {tx('Zur Bedienung · Esc')}
        </button>
      </div>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <div style={{ width: 'min(100vw, calc((100dvh - 52px) * 16 / 9))' }}>
          <RaceCanvas config={view.config || config} demoCount={view.demoCount} demoStart={demoStart} />
        </div>
      </div>
    </section>,
    document.body
  )
}
