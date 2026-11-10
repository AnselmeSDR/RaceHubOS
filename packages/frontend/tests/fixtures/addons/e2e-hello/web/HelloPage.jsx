import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GREETING_KEY } from '@addon/web/greeting.js'

export default function HelloPage() {
  const { t } = useTranslation('e2e-hello')
  const [server, setServer] = useState(null)

  useEffect(() => {
    fetch('/api/addons/e2e-hello/hello')
      .then((res) => res.json())
      .then((body) => setServer(body.from))
  }, [])

  return (
    <div className="p-6">
      <p data-testid="e2e-hello-greeting">{t(GREETING_KEY)}</p>
      <p data-testid="e2e-hello-server">{server}</p>
      {/* A Tailwind class no core file uses: generated only if the add-on's files are scanned */}
      <p data-testid="e2e-hello-styled" className="tracking-[7px]">
        styled
      </p>
    </div>
  )
}
