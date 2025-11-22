import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { XMarkIcon, CheckIcon } from '@heroicons/react/24/outline'

/**
 * ImageCropper - Composant de recadrage d'image
 * @param {Object} props
 * @param {string} props.image - URL ou base64 de l'image à recadrer
 * @param {function} props.onCropComplete - Callback avec l'image croppée en base64
 * @param {function} props.onCancel - Callback pour annuler
 * @param {string} props.cropShape - 'round' ou 'rect' (défaut: 'round')
 * @param {number} props.aspect - Ratio aspect (défaut: 1 pour carré)
 */
export default function ImageCropper({
  image,
  onCropComplete,
  onCancel,
  cropShape = 'round',
  aspect = 1
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)

  const onCropChange = useCallback((crop) => {
    setCrop(crop)
  }, [])

  const onZoomChange = useCallback((zoom) => {
    setZoom(zoom)
  }, [])

  const onCropAreaChange = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const handleComplete = async () => {
    try {
      const croppedImage = await getCroppedImg(image, croppedAreaPixels)
      onCropComplete(croppedImage)
    } catch (error) {
      console.error('Error cropping image:', error)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-700 p-4 flex items-center justify-between">
        <h3 className="text-white font-bold text-lg">Recadrer l'image</h3>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2"
          >
            <XMarkIcon className="w-5 h-5" />
            Annuler
          </button>
          <button
            onClick={handleComplete}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <CheckIcon className="w-5 h-5" />
            Valider
          </button>
        </div>
      </div>

      {/* Crop Area */}
      <div className="flex-1 relative">
        <Cropper
          image={image}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          cropShape={cropShape}
          showGrid={true}
          onCropChange={onCropChange}
          onZoomChange={onZoomChange}
          onCropComplete={onCropAreaChange}
        />
      </div>

      {/* Controls */}
      <div className="bg-gray-900 border-t border-gray-700 p-6">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-4">
            <span className="text-white text-sm font-medium whitespace-nowrap">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
            <span className="text-white text-sm font-medium w-12 text-right">
              {Math.round(zoom * 100)}%
            </span>
          </div>
          <p className="text-gray-400 text-sm mt-4 text-center">
            Glissez l'image pour la repositionner • Utilisez le zoom pour ajuster la taille
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * Fonction utilitaire pour créer l'image croppée
 */
async function getCroppedImg(imageSrc, pixelCrop) {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    return null
  }

  // Set canvas size to match the crop area
  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height

  // Draw the cropped image
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  )

  // Convert to base64
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve(null)
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => {
        resolve(reader.result)
      }
      reader.readAsDataURL(blob)
    }, 'image/jpeg', 0.95)
  })
}

/**
 * Fonction utilitaire pour créer un élément Image depuis une source
 */
function createImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.setAttribute('crossOrigin', 'anonymous')
    image.src = url
  })
}
