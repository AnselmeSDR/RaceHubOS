import { useState, useRef } from 'react'
import { PhotoIcon, TrashIcon } from '@heroicons/react/24/outline'
import ImageCropper from '../ImageCropper'

/**
 * Photo upload field with cropper integration
 * Reduces ~70 lines of duplicated code per CRUD page
 *
 * @param {object} props
 * @param {string} props.label - Field label
 * @param {string} props.value - Current photo URL/data
 * @param {function} props.onChange - Photo change handler (receives base64 string)
 * @param {'round' | 'rect'} props.shape - Crop shape
 * @param {number} props.aspect - Aspect ratio (default 1 for square)
 * @param {string} props.primaryColor - Primary color for styling
 * @param {function} props.onError - Error handler
 */
export default function PhotoUploadField({
  label = 'Photo',
  value,
  onChange,
  shape = 'round',
  aspect = 1,
  primaryColor = '#3B82F6',
  onError
}) {
  const [showCropper, setShowCropper] = useState(false)
  const [imageToCrop, setImageToCrop] = useState(null)
  const fileInputRef = useRef(null)

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
    reader.readAsDataURL(file)
  }

  const handleCropComplete = (croppedImage) => {
    onChange(croppedImage)
    setShowCropper(false)
    setImageToCrop(null)
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleRemove = () => {
    onChange(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>

      <div className="flex items-center gap-4">
        {/* Preview */}
        <div
          className={`relative w-20 h-20 ${shape === 'round' ? 'rounded-full' : 'rounded-lg'} overflow-hidden bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300`}
        >
          {value ? (
            <>
              <img
                src={value}
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
            id="photo-upload"
          />
          <label
            htmlFor="photo-upload"
            style={{ borderColor: primaryColor, color: primaryColor }}
            className="inline-block px-4 py-2 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            {value ? 'Changer' : 'Choisir une image'}
          </label>
          <p className="text-xs text-gray-500 mt-1">
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
