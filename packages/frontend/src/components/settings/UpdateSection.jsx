import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { io } from 'socket.io-client'
import { AlertTriangle, ArrowUpCircle, CheckCircle, Download, Loader2, RefreshCw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Modal, { ModalFooter } from '@/components/ui/Modal'

const API_URL = import.meta.env.VITE_API_URL || ''
const WS_URL = import.meta.env.VITE_WS_URL || ''

/** Reloads the page once the server answers again, after the restart that ends an update. */
function reloadWhenServerIsBack() {
  const tryReconnect = () => {
    fetch(`${API_URL}/health`)
      .then(() => {
        window.location.reload()
      })
      .catch(() => {
        setTimeout(tryReconnect, 2000)
      })
  }
  setTimeout(tryReconnect, 3000)
}

/** Current version, check for a new one and update the app, with the live progress. */
export default function UpdateSection() {
  const { t } = useTranslation('settings')
  const [updateInfo, setUpdateInfo] = useState(null)
  const [checking, setChecking] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [updateProgress, setUpdateProgress] = useState(null)
  const [confirmReplace, setConfirmReplace] = useState(false)

  // Check for updates on mount
  useEffect(() => {
    fetch(`${API_URL}/api/update/check`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setUpdateInfo(d.data)
      })
      .catch(() => {
        fetch(`${API_URL}/health`)
          .then((r) => r.json())
          .then((d) => {
            setUpdateInfo({ currentVersion: d.version })
          })
          .catch(() => {})
      })
  }, [])

  async function checkUpdate() {
    setChecking(true)
    try {
      const res = await fetch(`${API_URL}/api/update/check`)
      const data = await res.json()
      if (data.success) setUpdateInfo(data.data)
    } catch {
      setUpdateInfo({ error: t('update.cantCheck') })
    } finally {
      setChecking(false)
    }
  }

  /** `replaceLocal`: the user agreed to replace a local code that diverged from GitHub. */
  async function applyUpdate(replaceLocal = false) {
    setConfirmReplace(false)
    setUpdating(true)
    setUpdateProgress({ step: 0, message: t('update.starting'), status: 'running' })
    try {
      const res = await fetch(`${API_URL}/api/update/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replaceLocal }),
      })
      const data = await res.json()
      if (data.diverged) {
        // The update cannot fast-forward: ask before replacing the local code
        setUpdateProgress(null)
        setUpdating(false)
        setConfirmReplace(true)
        return
      }
      if (!data.success) {
        setUpdateProgress({ step: 0, message: data.error || t('update.genericError'), status: 'error' })
        setUpdating(false)
      }
    } catch {
      setUpdateProgress({ step: 0, message: t('update.connectionError'), status: 'error' })
      setUpdating(false)
    }
  }

  // Listen for update progress via WebSocket
  useEffect(() => {
    const socket = io(WS_URL, { transports: ['websocket', 'polling'] })

    socket.on('update:progress', (data) => {
      setUpdateProgress(data)
      if (data.status === 'complete') reloadWhenServerIsBack()
      if (data.status === 'error') {
        setUpdating(false)
      }
    })

    // Detect disconnect during update — poll /health until server is back
    socket.on('disconnect', () => {
      setUpdateProgress((prev) => {
        if (!prev || prev.status !== 'running') return prev
        reloadWhenServerIsBack()
        return { ...prev, message: t('update.serverRestart') }
      })
    })

    return () => socket.disconnect()
  }, [t])

  return (
    <Card data-testid="settings-update">
      <CardContent>
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <Download className="size-4 text-blue-500" />
          {t('update.title')}
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t('update.currentVersion')}</p>
              <p className="font-mono font-bold">{updateInfo?.currentVersion || '...'}</p>
            </div>
            <div className="flex items-center gap-2">
              {!updating && (
                <Button variant="outline" size="sm" onClick={checkUpdate} disabled={checking}>
                  {checking ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  {t('update.check')}
                </Button>
              )}
            </div>
          </div>

          {updateInfo?.updateAvailable && !updating && (
            <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
              <div>
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  {t('update.newVersionAvailable', { version: updateInfo.latestVersion })}
                </p>
              </div>
              <Button size="sm" onClick={() => applyUpdate()}>
                <ArrowUpCircle className="size-4" />
                {t('update.updateButton')}
              </Button>
            </div>
          )}

          {updateInfo && !updateInfo.updateAvailable && !updateInfo.error && !updating && (
            <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
              <CheckCircle className="size-4" />
              {t('update.upToDate')}
            </p>
          )}

          {updateInfo?.error && !updating && <p className="text-sm text-destructive">{updateInfo.error}</p>}

          {(updating || updateProgress?.status === 'error') && updateProgress && (
            <div className="space-y-2">
              <div
                className={`flex items-center gap-2 ${updateProgress.status === 'error' ? 'p-3 bg-destructive/10 rounded-lg border border-destructive/30' : ''}`}
              >
                {updateProgress.status === 'running' && <Loader2 className="size-4 animate-spin text-blue-500" />}
                {updateProgress.status === 'complete' && <CheckCircle className="size-4 text-green-500" />}
                {updateProgress.status === 'error' && <span className="text-destructive font-bold">✕</span>}
                <p className={`text-sm flex-1 ${updateProgress.status === 'error' ? 'text-destructive' : ''}`}>
                  {updateProgress.message}
                </p>
                {updateProgress.status === 'error' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setUpdateProgress(null)
                      setUpdating(false)
                    }}
                  >
                    {t('common:close')}
                  </Button>
                )}
              </div>
              {updateProgress.status === 'running' && (
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-500 rounded-full"
                    style={{ width: `${(updateProgress.step / 7) * 100}%` }}
                  />
                </div>
              )}
              {updateProgress.status === 'complete' && (
                <p className="text-xs text-muted-foreground">{t('update.restarting')}</p>
              )}
            </div>
          )}
        </div>
        <Modal
          open={confirmReplace}
          onClose={() => setConfirmReplace(false)}
          title={t('update.diverged.title')}
          icon={<AlertTriangle className="size-5 text-amber-500" />}
        >
          <p className="text-sm">{t('update.diverged.message')}</p>
          <ModalFooter>
            <Button variant="outline" onClick={() => setConfirmReplace(false)}>
              {t('common:cancel')}
            </Button>
            <Button variant="destructive" onClick={() => applyUpdate(true)}>
              {t('update.diverged.confirm')}
            </Button>
          </ModalFooter>
        </Modal>
      </CardContent>
    </Card>
  )
}
