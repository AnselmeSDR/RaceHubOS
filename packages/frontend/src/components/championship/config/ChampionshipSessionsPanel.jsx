import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { ChampionshipStatus, SessionType, sessionTypeKey } from '@racehubos/shared'
import { Button } from '@/components/ui/button'
import { deleteSession } from '@/lib/sessionApi'
import ConfigSessionRow from './ConfigSessionRow'
import SessionLimitsEditor from './SessionLimitsEditor'
import { addChampionshipSession, swapSessionOrder, updateSessionLimits } from './championshipConfigApi'
import {
  NEW_SESSION_FORM,
  needsLimit,
  nextSessionLabel,
  scheduledSessions,
  sessionFormOf,
  sessionLabel,
} from './sessionLimits'

// The free practices, qualifying sessions and races of a championship: add, edit, reorder, delete
export default function ChampionshipSessionsPanel({ championship, sessions, onChanged, onError }) {
  const { t } = useTranslation('championships')
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState(NEW_SESSION_FORM)
  const [newType, setNewType] = useState(null)
  const [newForm, setNewForm] = useState(NEW_SESSION_FORM)
  const locked = championship?.status === ChampionshipStatus.FINISHED
  const scheduled = scheduledSessions(sessions)

  // Each change reloads the sessions; an error is shown above the sheet
  async function run(action) {
    try {
      await action()
      onChanged?.()
    } catch (err) {
      onError(err.message)
    }
  }

  const create = () =>
    run(async () => {
      const order = scheduled.length
      await addChampionshipSession(
        championship.id,
        { type: newType, form: newForm, order },
        t('configModal.genericError')
      )
      setNewType(null)
      setNewForm(NEW_SESSION_FORM)
    })

  const update = (sessionId) =>
    run(async () => {
      await updateSessionLimits(sessionId, editForm)
      setEditing(null)
    })

  function move(index, direction) {
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= scheduled.length) return
    return run(() => swapSessionOrder(scheduled[index], index, scheduled[target], target))
  }

  function startEditing(session) {
    setEditing(session.id)
    setEditForm(sessionFormOf(session))
  }

  return (
    <div data-testid="championship-config-sessions">
      <div className="flex flex-wrap items-center justify-between gap-1 mb-2">
        <span className="text-xs font-medium text-muted-foreground">{t('configModal.sessions')}</span>
        <div className="flex flex-wrap gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setNewType(SessionType.PRACTICE)}
            disabled={locked}
            className="text-session-practice h-7"
          >
            <Plus className="size-3" /> {t(sessionTypeKey(SessionType.PRACTICE))}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setNewType(SessionType.QUALIF)}
            disabled={locked}
            className="text-blue-500 h-7"
          >
            <Plus className="size-3" /> {t('configModal.addQualif')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setNewType(SessionType.RACE)}
            disabled={locked}
            className="text-green-500 h-7"
          >
            <Plus className="size-3" /> {t('configModal.addRace')}
          </Button>
        </div>
      </div>

      <div className="border border-border rounded-lg divide-y divide-border">
        {scheduled.length === 0 && !newType && (
          <div className="p-6 text-center text-muted-foreground text-sm">{t('configModal.noSessions')}</div>
        )}

        {scheduled.map((session, index) => (
          <div key={session.id} className="p-3">
            {editing === session.id ? (
              <SessionLimitsEditor
                type={session.type}
                label={sessionLabel(session, scheduled, t)}
                form={editForm}
                onChange={setEditForm}
                onConfirm={() => update(session.id)}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <ConfigSessionRow
                session={session}
                label={sessionLabel(session, scheduled, t)}
                first={index === 0}
                last={index === scheduled.length - 1}
                locked={locked}
                onMove={(direction) => move(index, direction)}
                onEdit={() => startEditing(session)}
                onDelete={() => run(() => deleteSession(session.id))}
              />
            )}
          </div>
        ))}

        {newType && (
          <div className="p-3 bg-muted/50">
            <SessionLimitsEditor
              type={newType}
              label={nextSessionLabel(newType, scheduled, t)}
              form={newForm}
              onChange={setNewForm}
              onConfirm={create}
              onCancel={() => setNewType(null)}
              confirmLabel={t('configModal.create')}
              confirmDisabled={needsLimit(newType) && !newForm.useTime && !newForm.useLaps}
            />
          </div>
        )}
      </div>
    </div>
  )
}
