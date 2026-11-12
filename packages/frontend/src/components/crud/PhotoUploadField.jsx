import { useState, useRef, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { ImageIcon, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import PictureEditor from '@/components/picture/PictureEditor'
import PictureLayer from '@/components/picture/PictureLayer'
import { getImgUrl } from '../../utils/image'

const API_URL = import.meta.env.VITE_API_URL || ''

/**
 * The picture of a record: a chosen file, or the current picture with « Recadrer », goes through the
 * editor, which uploads a square PNG. `color` is the record's colour, offered as background.
 */
export default function PhotoUploadField({ label, value, onChange, onError, uploadType = 'drivers', color }) {
  const { t } = useTranslation('common')
  const [editing, setEditing] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)
  const inputId = useId()

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      onError?.(t('photo.selectImage'))
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => setEditing(reader.result)
    reader.onerror = () => onError?.(t('photo.readError'))
    reader.readAsDataURL(file)
  }

  const upload = async (blob) => {
    setEditing(null)
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('img', blob, 'image.png')
      const uploadRes = await fetch(`${API_URL}/api/upload/${uploadType}`, { method: 'POST', body: formData })
      const data = await uploadRes.json()
      if (data.success) onChange(data.data.url)
      else onError?.(data.error || t('photo.uploadError'))
    } catch (err) {
      console.error('Upload error:', err)
      onError?.(t('photo.uploadError'))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemove = () => {
    onChange(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-2">{label || t('photo.label')}</label>

      <div className="flex items-center gap-4">
        {value && !uploading ? (
          <div className="relative size-20 shrink-0">
            <PictureLayer img={value} fit={uploadType === 'cars' ? 'contain' : 'cover'} alt="" className="size-20" />
            <button
              type="button"
              onClick={handleRemove}
              aria-label={t('photo.remove')}
              className="absolute inset-0 rounded-[20%] bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center"
            >
              <Trash2 className="size-6 text-white" />
            </button>
          </div>
        ) : (
          <div className="size-20 shrink-0 rounded-[20%] bg-muted flex items-center justify-center border-2 border-dashed border-border">
            {uploading ? (
              <div className="animate-spin rounded-full size-8 border-b-2 border-primary" />
            ) : (
              <ImageIcon className="size-8 text-muted-foreground" />
            )}
          </div>
        )}

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            id={inputId}
            disabled={uploading}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" asChild disabled={uploading}>
              <label htmlFor={inputId} className={uploading ? 'cursor-wait' : 'cursor-pointer'}>
                {uploading ? t('photo.uploading') : value ? t('change') : t('photo.choose')}
              </label>
            </Button>
            {value && !uploading && (
              <Button type="button" variant="outline" size="sm" onClick={() => setEditing(getImgUrl(value))}>
                {t('photo.reframe')}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{t('photo.hint')}</p>
        </div>
      </div>

      {editing && <PictureEditor src={editing} color={color} onCancel={() => setEditing(null)} onSave={upload} />}
    </div>
  )
}
