import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import SessionDetailHeader from '../components/sessionDetail/SessionDetailHeader'
import SessionDnfList from '../components/sessionDetail/SessionDnfList'
import SessionLapHistory from '../components/sessionDetail/SessionLapHistory'
import SessionPodiumCard from '../components/sessionDetail/SessionPodiumCard'
import SessionResults from '../components/sessionDetail/SessionResults'
import { deleteSession, getData } from '../lib/sessionApi'
import { sessionEntries } from '../lib/sessionResults'

/** A stored session: its podium, leaderboard (or balancing chart) and lap history. */
export default function SessionDetail() {
  const { t } = useTranslation('sessions')
  const { id } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getData(`/api/sessions/${id}`).then((data) => {
      if (data) setSession(data)
      setLoading(false)
    })
  }, [id])

  const entries = useMemo(() => sessionEntries(session), [session])
  const back = () => navigate('/history')

  async function handleDelete() {
    try {
      const res = await deleteSession(id)
      if (res.ok) back()
    } catch (err) {
      console.error('Error deleting session:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full size-10 border-b-2 border-primary" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="p-8">
        <Button variant="ghost" onClick={back}>
          <ArrowLeft className="size-4" /> {t('common:back')}
        </Button>
        <p className="text-center text-muted-foreground mt-8">{t('profile.notFound')}</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <SessionDetailHeader session={session} onBack={back} onDelete={handleDelete} />
      <div className="flex-1 overflow-auto p-4 space-y-4">
        <SessionPodiumCard session={session} />
        <SessionDnfList entries={entries} />
        <SessionResults session={session} entries={entries} />
        <SessionLapHistory session={session} />
      </div>
    </div>
  )
}
