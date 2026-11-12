import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import DivisionChampionships from '@/components/division/DivisionChampionships'
import DivisionFormModal from '@/components/division/DivisionFormModal'
import DivisionIdentity from '@/components/division/DivisionIdentity'
import DivisionMembers from '@/components/division/DivisionMembers'
import DivisionProfileActions from '@/components/division/DivisionProfileActions'
import { getData } from '@/lib/sessionApi'

const API_URL = import.meta.env.VITE_API_URL || ''

/** A division's page: its drivers or cars, added and removed here, and the championships run for it. */
export default function DivisionProfile() {
  const { t } = useTranslation('divisions')
  const { id } = useParams()
  const navigate = useNavigate()
  const [division, setDivision] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showEdit, setShowEdit] = useState(false)
  // Bumped to read the division again, after its form
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let current = true
    getData(`/api/divisions/${id}`).then((data) => {
      if (!current) return
      setDivision(data)
      setLoading(false)
    })
    return () => {
      current = false
    }
  }, [id, version])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full size-10 border-b-2 border-primary" />
      </div>
    )
  }

  if (!division) {
    return (
      <div className="p-8">
        <Button variant="ghost" onClick={() => navigate('/divisions')}>
          <ArrowLeft className="size-4" /> {t('common:back')}
        </Button>
        <p className="text-center text-muted-foreground mt-8">{t('profile.notFound')}</p>
      </div>
    )
  }

  // Deleting from the page: the division goes to the bin, then we leave the page
  async function handleDelete() {
    try {
      await fetch(`${API_URL}/api/divisions/${division.id}`, { method: 'DELETE' })
    } finally {
      navigate('/divisions')
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div
        data-testid="division-profile-header"
        className="border-b px-4 py-3 flex flex-wrap gap-3 items-center justify-between"
      >
        <div className="basis-full sm:basis-auto sm:flex-1 min-w-0 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/divisions')}>
            <ArrowLeft className="size-4" />
          </Button>
          <DivisionIdentity division={division} />
        </div>
        <DivisionProfileActions division={division} onEdit={() => setShowEdit(true)} onDelete={handleDelete} />
      </div>

      {showEdit && (
        <DivisionFormModal
          division={division}
          scope={division.scope}
          onClose={() => {
            setShowEdit(false)
            setVersion((v) => v + 1)
          }}
        />
      )}

      <div className="@container flex-1 overflow-auto p-4">
        <div className="grid grid-cols-1 gap-4 items-start @5xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <DivisionMembers division={division} onChange={setDivision} />
          <DivisionChampionships division={division} />
        </div>
      </div>
    </div>
  )
}
