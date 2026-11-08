import { useEffect, useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useSession } from '../../context/SessionContext'
import { loadScreens } from '../../lib/raceScreenStorage'
import { shouldOpenScreen } from '../../lib/raceScreen'
import { RaceCanvas } from './RaceCanvas'

export default function RaceScreen() {
  const { t } = useTranslation('raceScreens')
  const { session } = useSession()
  const [settings, setSettings] = useState(null)
  const [view, setView] = useState(null)
  const [notice, setNotice] = useState('')
  const previous = useRef(null)
  const closeButton = useRef(null)
  const fullscreenOwned = useRef(false)
  const close = useCallback(() => {
    setView(null)
    if (fullscreenOwned.current && document.fullscreenElement) document.exitFullscreen().catch(() => {})
    fullscreenOwned.current = false
  }, [])
  async function fullscreen() {
    if (document.fullscreenElement) return
    try {
      await document.documentElement.requestFullscreen()
      fullscreenOwned.current = true
    } catch {
      setNotice(t('fullscreenDenied'))
    }
  }
  useEffect(() => {
    let active = true
    const load = () =>
      loadScreens()
        .then((value) => {
          if (active) {
            setSettings(value)
            if (!value.enabled) {
              setView(null)
              if (fullscreenOwned.current && document.fullscreenElement) document.exitFullscreen().catch(() => {})
              fullscreenOwned.current = false
            }
          }
        })
        .catch(() => {})
    load()
    const preview = (event) => {
      setNotice('')
      setView({ config: event.detail.config, demoCount: event.detail.count })
    }
    window.addEventListener('race:screen-settings', load)
    window.addEventListener('race:screen-preview', preview)
    return () => {
      active = false
      window.removeEventListener('race:screen-settings', load)
      window.removeEventListener('race:screen-preview', preview)
    }
  }, [])
  useEffect(() => {
    const open = () => {
      if (!settings?.enabled) return
      const profile = settings.profiles.find((item) => item.id === settings.activeProfile)
      setView({ config: profile.layout })
      if (settings.fullscreen && !document.fullscreenElement)
        document.documentElement
          .requestFullscreen()
          .then(() => {
            fullscreenOwned.current = true
          })
          .catch(() => setNotice(t('fullscreenDenied')))
    }
    window.addEventListener('race:screen-open', open)
    return () => window.removeEventListener('race:screen-open', open)
  }, [settings, t])
  useEffect(() => {
    if (!settings) return
    if (shouldOpenScreen(previous.current, session, settings)) {
      const profile = settings.profiles.find((item) => item.id === settings.activeProfile)
      const open = () => {
        setView({ config: profile.layout })
        if (settings.fullscreen)
          document.documentElement
            .requestFullscreen()
            .then(() => {
              fullscreenOwned.current = true
            })
            .catch(() => setNotice(t('fullscreenDenied')))
      }
      const timer = setTimeout(open, 0)
      previous.current = session ? { id: session.id, status: session.status } : null
      return () => clearTimeout(timer)
    }
    previous.current = session ? { id: session.id, status: session.status } : null
  }, [session, settings, t])
  if (!view) return null
  return (
    <Dialog
      open={!!view}
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <DialogContent
        showCloseButton={false}
        data-testid="race-screen-dialog"
        className="flex h-dvh w-screen max-w-none sm:max-w-none flex-col rounded-none bg-background text-foreground p-0 gap-0"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('close')}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-3 border-b bg-card p-3">
          <span>{t(view.demoCount ? 'previewTitle' : 'title')}</span>
          {notice && <span role="status">{notice}</span>}
          <Button className="ml-auto" variant="outline" onClick={fullscreen}>
            {t('fullscreen')}
          </Button>
          <Button ref={closeButton} onClick={close}>
            {t('close')}
          </Button>
        </div>
        <div className="flex flex-1 min-h-0 items-center justify-center overflow-hidden">
          <div className="w-[min(100vw,calc((100dvh-64px)*16/9))]">
            <RaceCanvas config={view.config} demoCount={view.demoCount} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
