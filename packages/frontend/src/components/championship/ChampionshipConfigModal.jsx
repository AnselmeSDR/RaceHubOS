import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trophy } from 'lucide-react'
import { ChampionshipMode, ChampionshipStatus } from '@racehubos/shared'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import ChampionshipConfigFooter from './config/ChampionshipConfigFooter'
import ChampionshipInfoFields from './config/ChampionshipInfoFields'
import ChampionshipParticipantsPanel from './config/ChampionshipParticipantsPanel'
import ChampionshipSessionsPanel from './config/ChampionshipSessionsPanel'
import { reopenChampionship, saveChampionshipInfo } from './config/championshipConfigApi'

export default function ChampionshipConfigModal({
  championship,
  sessions = [],
  tracks = [],
  drivers = [],
  open,
  onClose,
  onSave,
  onFinish,
  onSessionsChange,
}) {
  const { t } = useTranslation('championships')
  const [name, setName] = useState(championship?.name || '')
  const [trackId, setTrackId] = useState(championship?.trackId || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // The fields follow the championship each time it is reloaded while the sheet is open
  const source = open ? championship : null
  const [syncedWith, setSyncedWith] = useState(source)
  if (source !== syncedWith) {
    setSyncedWith(source)
    if (source) {
      setName(source.name || '')
      setTrackId(source.trackId || '')
    }
  }

  // A finished championship is a record: its configuration is read-only
  const isFinished = championship?.status === ChampionshipStatus.FINISHED

  async function handleSave() {
    if (!name.trim()) {
      setError(t('configModal.nameRequired'))
      return
    }
    setSaving(true)
    setError('')
    try {
      onSave(await saveChampionshipInfo(championship.id, { name, trackId }, t('configModal.genericError')))
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleReopen() {
    try {
      const reopened = await reopenChampionship(championship.id)
      if (!reopened) return
      onSave(reopened)
      onClose()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="data-[side=right]:sm:max-w-xl flex flex-col p-0">
        <SheetHeader className="px-4 pt-4 pb-2">
          <SheetTitle className="flex items-center gap-2">
            <Trophy className="size-4 text-yellow-500" />
            {t('configModal.title')}
          </SheetTitle>
          <SheetDescription>{championship?.name}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-auto px-4 space-y-4 pb-4">
          {error && (
            <div
              role="alert"
              className="p-2 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm"
            >
              {error}
            </div>
          )}

          {isFinished && (
            <div className="rounded-md border border-yellow-500/50 bg-yellow-500/10 px-3 py-2 text-xs">
              {t('configModal.finishedLocked')}
            </div>
          )}
          <ChampionshipInfoFields
            championship={championship}
            tracks={tracks}
            name={name}
            trackId={trackId}
            disabled={isFinished}
            onNameChange={setName}
            onTrackChange={setTrackId}
          />

          {championship?.mode === ChampionshipMode.AUTO && (
            <ChampionshipParticipantsPanel
              championship={championship}
              sessions={sessions}
              drivers={drivers}
              onChanged={onSessionsChange}
              onError={setError}
            />
          )}

          <ChampionshipSessionsPanel
            championship={championship}
            sessions={sessions}
            onChanged={onSessionsChange}
            onError={setError}
          />
        </div>

        <ChampionshipConfigFooter
          championship={championship}
          saving={saving}
          onReopen={handleReopen}
          onFinish={
            onFinish &&
            (() => {
              onFinish()
              onClose()
            })
          }
          onClose={onClose}
          onSave={handleSave}
        />
      </SheetContent>
    </Sheet>
  )
}
