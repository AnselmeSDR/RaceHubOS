import { useState, useRef, useId } from 'react'
import { PhotoIcon, TrashIcon } from '@heroicons/react/24/outline'
import ImageCropper from '../ImageCropper'
import { getImgUrl } from '../../utils/image'

const API_URL = import.meta.env.VITE_API_URL || ''

/**
 * Photo upload field with cropper integration
 * Uploads to server and returns URL path
 *
 * @param {object} props
 * @param {string} props.label - Field label
 * @param {string} props.value - Current photo URL
 * @param {function} props.onChange - Photo change handler (receives URL string)
 * @param {'round' | 'rect'} props.shape - Crop shape
 * @param {number} props.aspect - Aspect ratio (default 1 for square)
 * @param {string} props.primaryColor - Primary color for styling
 * @param {function} props.onError - Error handler
 * @param {'drivers' | 'cars' | 'tracks'} props.uploadType - Type of upload for folder organization
 */
export default function PhotoUploadField({
  label = 'Photo',
  value,
  onChange,
  shape = 'round',
  aspect = 1,
  primaryColor = '#3B82F6',
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
    reader.onerror = () => {
      onError?.('Erreur lors de la lecture du fichier')
    }
    reader.readAsDataURL(file)
  }

  const handleCropComplete = async (croppedImage) => {
    setShowCropper(false)
    setImageToCrop(null)
    setUploading(true)

    try {
      // Convert base64 to blob
      const response = await fetch(croppedImage)
      const blob = await response.blob()

      // Create form data
      const formData = new FormData()
      formData.append('img', blob, 'image.jpg')

      // Upload to server
      const uploadRes = await fetch(`${API_URL}/api/upload/${uploadType}`, {
        method: 'POST',
        body: formData
      })

      const data = await uploadRes.json()

      if (data.success) {
        onChange(data.data.url)
      } else {
        onError?.(data.error || 'Erreur lors de l\'upload')
      }
    } catch (err) {
      console.error('Upload error:', err)
      onError?.('Erreur lors de l\'upload de l\'image')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemove = () => {
    onChange(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Build full image URL
  const imageUrl = getImgUrl(value)

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>

      <div className="flex items-center gap-4">
        {/* Preview */}
        <div
          className={`relative w-20 h-20 ${shape === 'round' ? 'rounded-full' : 'rounded-lg'} overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600`}
        >
          {uploading ? (
            <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: primaryColor }} />
          ) : imageUrl ? (
            <>
              <img
                src={imageUrl}
                alt="Preview"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={handleRemove}
                className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                <TrashIcon className="w-6 h-6 text-white" />
              </button>
            </>
          ) : (
            <PhotoIcon className="w-8 h-8 text-gray-400" />
          )}
        </div>

        {/* Upload button */}
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
          <label
            htmlFor={inputId}
            style={{ borderColor: primaryColor, color: uploading ? '#9CA3AF' : primaryColor }}
            className={`inline-block px-4 py-2 border-2 rounded-lg transition-colors text-sm font-medium ${uploading ? 'cursor-wait bg-gray-50 dark:bg-gray-700' : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          >
            {uploading ? 'Upload...' : (value ? 'Changer' : 'Choisir une image')}
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            JPG, PNG ou GIF. Max 5MB.
          </p>
        </div>
      </div>

      {/* Cropper modal */}
      {showCropper && imageToCrop && (
        <ImageCropper
          image={imageToCrop}
          onCropComplete={handleCropComplete}
          onCancel={() => {
            setShowCropper(false)
            setImageToCrop(null)
          }}
          cropShape={shape}
          aspect={aspect}
        />
      )}
    </div>
  )
}
