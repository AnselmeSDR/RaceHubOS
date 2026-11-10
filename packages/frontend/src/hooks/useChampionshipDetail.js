import { useCallback, useEffect, useEffectEvent, useMemo, useState } from 'react'
import { ChampionshipMode } from '@racehubos/shared'
import { finishChampionship, getChampionship, getChampionshipSessions, getStandings } from '@/lib/championshipApi'
import { getReferenceData } from '@/lib/sessionApi'
import { useWindowEvents } from './useWindowEvents'

const EMPTY_STANDINGS = { practice: [], qualif: [], race: [] }
const REFRESH_EVENTS = ['session:finished', 'session:status_changed', 'championship:races_assigned']

/**
 * A championship with its sessions, the drivers, cars and tracks to configure them, and its standings.
 *
 * The selected session is remembered per championship. With none selected, loading the sessions
 * selects the first one; a selected session that no longer exists falls back to the first one.
 * Sessions and standings reload when a session finishes or changes status, or races are assigned.
 * `sessionDrivers` are the drivers a session can take: an automatic championship's participants only.
 */
export function useChampionshipDetail(id) {
  const storageKey = `championship_${id}_session`
  const [championship, setChampionship] = useState(null)
  const [sessions, setSessions] = useState([])
  const [drivers, setDrivers] = useState([])
  const [cars, setCars] = useState([])
  const [tracks, setTracks] = useState([])
  const [standings, setStandings] = useState(EMPTY_STANDINGS)
  const [loadedId, setLoadedId] = useState(null)
  const [selectedId, setSelectedId] = useState(() => localStorage.getItem(storageKey) || null)

  const selectedSession = sessions.find((s) => s.id === selectedId) ?? (selectedId ? (sessions[0] ?? null) : null)
  const currentId = selectedSession?.id ?? selectedId

  const sessionDrivers = useMemo(() => {
    if (championship?.mode !== ChampionshipMode.AUTO || !championship.participants?.length) return drivers
    const participantIds = new Set(championship.participants.map((p) => p.driverId))
    return drivers.filter((d) => participantIds.has(d.id))
  }, [drivers, championship])

  useEffect(() => {
    if (currentId) localStorage.setItem(storageKey, currentId)
    else localStorage.removeItem(storageKey)
  }, [storageKey, currentId])

  const reloadChampionship = useCallback(
    () =>
      getChampionship(id).then((data) => {
        if (data) setChampionship(data)
      }),
    [id]
  )

  const reloadSessions = useCallback(
    () =>
      getChampionshipSessions(id).then((list) => {
        if (!list) return
        setSessions(list)
        setSelectedId((current) => {
          if (list.length === 0) return current
          if (!selectedId) return list[0].id
          return current && !list.some((s) => s.id === current) ? list[0].id : current
        })
      }),
    [id, selectedId]
  )

  const reloadStandings = useCallback(
    () =>
      getStandings(id).then((data) => {
        if (data) setStandings(data)
      }),
    [id]
  )

  const finish = useCallback(
    () =>
      finishChampionship(id).then((data) => {
        if (data) setChampionship(data)
      }),
    [id]
  )

  const loadAll = useEffectEvent(() =>
    Promise.all([
      reloadChampionship(),
      reloadSessions(),
      getReferenceData().then((data) => {
        if (data.drivers) setDrivers(data.drivers)
        if (data.cars) setCars(data.cars)
        if (data.tracks) setTracks(data.tracks)
      }),
      reloadStandings(),
    ])
  )
  useEffect(() => {
    loadAll().then(() => setLoadedId(id))
  }, [id])

  useWindowEvents(REFRESH_EVENTS, () => {
    reloadSessions()
    reloadStandings()
  })

  return {
    championship,
    setChampionship,
    sessions,
    drivers,
    sessionDrivers,
    cars,
    tracks,
    standings,
    loading: loadedId !== id,
    selectedSession,
    selectSession: setSelectedId,
    reloadChampionship,
    reloadSessions,
    reloadStandings,
    finish,
  }
}
