import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'

const API_URL = import.meta.env.VITE_API_URL || ''

/**
 * Downloads an Excel workbook from an export route.
 *
 * The file name comes from the server's Content-Disposition, so a session and
 * a championship keep the same naming without the page having to know it.
 */
export default function ExportButton({ url, label = null, size, variant = 'outline' }) {
  const { t } = useTranslation('common')
  const [busy, setBusy] = useState(false)

  async function handleExport() {
    if (busy) return
    setBusy(true)

    try {
      const response = await fetch(`${API_URL}${url}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const blob = await response.blob()
      const disposition = response.headers.get('Content-Disposition') || ''
      const fileName = disposition.match(/filename="([^"]+)"/)?.[1] || 'export.xlsx'

      const href = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = href
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(href)
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size ?? (label ? 'sm' : 'icon-sm')}
      onClick={handleExport}
      disabled={busy}
      data-testid="export-button"
      title={t('exportExcel')}
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
      {label}
    </Button>
  )
}
