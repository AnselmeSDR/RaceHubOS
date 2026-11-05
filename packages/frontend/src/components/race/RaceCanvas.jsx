import { useTranslation } from 'react-i18next'
import { useRef } from 'react'
import { useSession } from '../../context/SessionContext'
import { useLiveCuTelemetry } from './useLiveCuTelemetry'
import { fuelTelemetry } from '../../lib/fuelTelemetry.js'
import { screenGap, screenFields, screenTime as formatScreenTime, startLights } from '../../lib/raceScreen.js'
import { getImgUrl } from '../../utils/image'
const statuses = {
  draft: 'readyToStart',
  active: 'raceInProgress',
  paused: 'paused',
  finishing: 'finishing',
  finished: 'finished',
}
function demoEntries(count, t) {
  return Array.from(
    {
      length: count,
    },
    (_, i) => ({
      id: `demo-${i}`,
      controller: i,
      position: i + 1,
      driver: {
        name: t('testDriverV0', {
          v0: i + 1,
        }),
        number: i + 11,
        color: ['#38bdf8', '#f97316', '#a78bfa', '#34d399', '#f472b6', '#facc15'][i],
        team: {
          name: t('testTeam'),
        },
      },
      car: {
        brand: 'RaceHubOS',
        model: t('testCarV0', {
          v0: i + 1,
        }),
      },
      stats: {
        laps: 12 - i,
        bestLap: 8234 + i * 133,
        lastLap: 8456 + i * 222,
        totalTime: 108000,
        gap: {
          type: 'time',
          value: i * 850,
        },
      },
    })
  )
}
function Field({ id, config, selected, edit, children, label = true, fontScale = 1 }) {
  const { t } = useTranslation('raceScreens')
  const b = config.widgets[id]
  const drag = useRef(null)
  if (!b.visible) return null
  function pointerDown(event, resize = false) {
    if (!edit) return
    event.stopPropagation()
    event.preventDefault()
    const rect = event.currentTarget.closest('[data-field]')?.parentElement.getBoundingClientRect()
    if (!rect) return
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      box: {
        ...b,
      },
      rect,
      resize,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    edit(id)
  }
  function pointerMove(event) {
    const d = drag.current
    if (!d) return
    const dx = ((event.clientX - d.x) / d.rect.width) * 100
    const dy = ((event.clientY - d.y) / d.rect.height) * 100
    edit(
      id,
      d.resize
        ? {
            w: d.box.w + dx,
            h: d.box.h + dy,
          }
        : {
            x: d.box.x + dx,
            y: d.box.y + dy,
          }
    )
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
      {label && (
        <div
          style={{
            fontSize: '.45em',
            opacity: 0.65,
            whiteSpace: 'nowrap',
          }}
        >
          {t(screenFields[id])}
        </div>
      )}
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
          aria-label={t('resizeV0', {
            v0: t(screenFields[id]),
          })}
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
  const { t, i18n } = useTranslation('raceScreens')
  const screenTime = (value) => formatScreenTime(value, i18n.resolvedLanguage)
  const fuel = fuelTelemetry({
    connected: device.connected,
    socketConnected: device.socketConnected,
    status: device.cuStatus,
    receivedAt: device.lastStatusAt,
    now: device.now,
    controller: entry.controller,
  })
  const raw = demo ? 14 - index : fuel.enabled ? fuel.raw : null
  const gap = screenGap(entry, leader, sessionType)
  const gapText =
    index === 0
      ? t('leader')
      : gap?.type === 'laps'
        ? t('v0Laps', {
            v0: gap.value,
          })
        : gap?.type === 'time'
          ? `+${screenTime(gap.value)}`
          : typeof gap === 'number'
            ? `+${screenTime(gap)}`
            : typeof gap === 'string'
              ? gap
              : '—'
  const values = {
    position: entry.position || index + 1,
    photo: entry.driver?.img ? (
      <img
        src={getImgUrl(entry.driver.img)}
        alt=""
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        }}
      />
    ) : (
      <span
        style={{
          color: entry.driver?.color,
        }}
      >
        {entry.driver?.name?.charAt(0) || '?'}
      </span>
    ),
    name: entry.driver?.name || t('unknownDriver'),
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
          <div
            style={{
              height: 5,
              width: '95%',
              background: '#334155',
            }}
          >
            <div
              style={{
                width: `${(raw / 15) * 100}%`,
                height: '100%',
                background: raw <= 3 ? '#f87171' : '#4ade80',
              }}
            />
          </div>
        )}
      </>
    ),
    pit: demo ? t('track') : !fuel.available ? '—' : !fuel.enabled ? 'FUEL OFF' : fuel.inPit ? t('pit') : t('track'),
    dnf: entry.isDNF ? t('retired') : '—',
  }
  return (
    <div
      data-testid={`race-driver-row-${index + 1}`}
      onPointerDown={(event) => {
        if (demo && index > 0) event.stopPropagation()
      }}
      aria-label={
        edit && index === 0
          ? t('firstDriverRowTemplateForAllDrivers')
          : t('driverRowV0', {
              v0: index + 1,
            })
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
  const { t, i18n } = useTranslation('raceScreens')
  const screenTime = (value) => formatScreenTime(value, i18n.resolvedLanguage)
  const { session, entries, elapsed, remaining } = useSession()
  const device = useLiveCuTelemetry(!demoCount)
  const demo = Boolean(demoCount)
  const drivers = demo ? demoEntries(demoCount, t) : entries.slice(0, 6)
  const lights = startLights(demo ? demoStart : device.cuStatus?.start, demo || device.connectionState === 'live')
  const values = {
    title: demo ? t('exampleRacePreview') : session?.name || t('noSessionSelected'),
    track: demo ? t('testTrack') : session?.track?.name || '—',
    status: demo ? t('raceInProgress') : t(statuses[session?.status] || 'readyToStart') || t('ready'),
    elapsed: screenTime(demo ? 108000 : elapsed * 1000),
    remaining: screenTime(demo ? 72000 : remaining == null ? null : remaining * 1000),
    limit: demo
      ? t('1230Laps')
      : session?.maxLaps
        ? `${Math.max(0, ...drivers.map((d) => d.stats?.laps || 0))} / ${session.maxLaps}`
        : t('noLapTarget'),
    connection: demo
      ? t('cuLiveFUELONExample')
      : device.connectionState === 'live'
        ? t('cuLive', { mode: device.cuStatus?.mode & 1 ? 'ON' : 'OFF' })
        : device.connectionState === 'stale'
          ? t('cuDataStale')
          : t('noCurrentCUData'),
  }
  return (
    <div
      data-testid="race-screen-canvas"
      role="img"
      aria-label={t('raceScreenV0', {
        v0: demo
          ? t('previewForV0Drivers', {
              v0: demoCount,
            })
          : '',
      })}
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
              {lights.go ? t('go') : lights.falseStart ? t('falseSTART') : t('startLights')}
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '3%',
                width: '90%',
              }}
            >
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
                {...{
                  entry,
                  index,
                  config,
                  selected,
                  device,
                  demo,
                }}
                edit={index === 0 ? edit : undefined}
              />
            ))
          ) : (
            <div
              style={{
                padding: 20,
              }}
            >
              {t('noDriversInThisSession')}
            </div>
          )}
        </div>
      </Field>
    </div>
  )
}
