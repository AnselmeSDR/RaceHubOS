import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Flag } from 'lucide-react'
import { useSession } from '@/context/SessionContext'

/** While a session runs: a banner leading to the race screen. */
export default function ActiveSessionBanner() {
  const { t } = useTranslation('dashboard')
  const navigate = useNavigate()
  const { session, isActive } = useSession()
  if (!isActive) return null

  return (
    <div
      data-testid="dashboard-active-session"
      className="relative overflow-hidden bg-gradient-to-r from-green-600 to-emerald-500 rounded-xl p-5 text-white cursor-pointer hover:shadow-xl transition-all group"
      onClick={() => navigate('/race')}
    >
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: 'repeating-linear-gradient(45deg, white, white 10px, transparent 10px, transparent 20px)',
        }}
      />
      <div className="relative flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="size-12 rounded-full bg-white/20 flex items-center justify-center">
            <Flag className="size-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-bold">{t('activeSession.title')}</h2>
            <span className="text-sm text-white/80">{session?.name || t('activeSession.fallbackName')}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-white/70 group-hover:text-white transition-colors">
          <span className="text-sm">{t('activeSession.join')}</span>
          <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </div>
  )
}
