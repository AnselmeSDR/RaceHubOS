import { useState, useRef, useId } from 'react'
import { ImageIcon, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ImageCropper from '../ImageCropper'
import { getImgUrl } from '../../utils/image'

const API_URL = import.meta.env.VITE_API_URL || ''

export default function PhotoUploadField({
  label = 'Photo',
  value,
  onChange,
  shape = 'round',
  aspect = 1,
  onError,
  uploadType = 'drivers'
}) {
  const [showCropper, setShowCropper] = useState(false)
  const [imageToCrop, setImageToCrop] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)
  const inputId = useId()

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      onError?.('Veuillez sélectionner une image.')
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => {
      setImageToCrop(reader.result)
      setShowCropper(true)
    }
    reader.onerror = () => onError?.('Erreur lors de la lecture du fichier')
    reader.readAsDataURL(file)
  }

  const handleCropComplete = async (croppedImage) => {
    setShowCropper(false)
    setImageToCrop(null)
    setUploading(true)
    try {
      const response = await fetch(croppedImage)
      const blob = await response.blob()
      const formData = new FormData()
      formData.append('img', blob, 'image.jpg')
      const uploadRes = await fetch(`${API_URL}/api/upload/${uploadType}`, {
        method: 'POST',
        body: formData
      })
      const data = await uploadRes.json()
      if (data.success) {
        onChange(data.data.url)
      } else {
        onError?.(data.error || "Erreur lors de l'upload")
      }
    } catch (err) {
      console.error('Upload error:', err)
      onError?.("Erreur lors de l'upload de l'image")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemove = () => {
    onChange(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const imageUrl = getImgUrl(value)

  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-2">{label}</label>

      <div className="flex items-center gap-4">
        <div
          className={`relative w-20 h-20 ${shape === 'round' ? 'rounded-full' : 'rounded-lg'} overflow-hidden bg-muted flex items-center justify-center border-2 border-dashed border-border`}
        >
          {uploading ? (
            <div className="animate-spin rounded-full size-8 border-b-2 border-primary" />
          ) : imageUrl ? (
            <>
              <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={handleRemove}
                className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                <Trash2 className="size-6 text-white" />
              </button>
            </>
          ) : (
            <ImageIcon className="size-8 text-muted-foreground" />
          )}
        </div>

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
          <Button
            type="button"
            variant="outline"
            size="sm"
            asChild
            disabled={uploading}
          >
            <label htmlFor={inputId} className={uploading ? 'cursor-wait' : 'cursor-pointer'}>
              {uploading ? 'Upload...' : (value ? 'Changer' : 'Choisir une image')}
            </label>
          </Button>
          <p className="text-xs text-muted-foreground mt-1">JPG, PNG ou GIF. Max 5MB.</p>
        </div>
      </div>

      {showCropper && imageToCrop && (
        <ImageCropper
          image={imageToCrop}
          onCropComplete={handleCropComplete}
          onCancel={() => { setShowCropper(false); setImageToCrop(null) }}
          cropShape={shape}
          aspect={aspect}
        />
      )}
    </div>
  )
}
