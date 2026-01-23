const API_URL = import.meta.env.VITE_API_URL || ''

/**
 * Get the full URL for an image path
 * - Data URLs (data:...) are returned unchanged (for previews)
 * - Full URLs (http...) are returned unchanged
 * - Relative paths (/api/img/...) are used as-is (works with same origin)
 * - Legacy /uploads/ paths are converted to /api/img/
 */
export function getImgUrl(img) {
  if (!img) return null
  // Data URL (preview) - return as-is
  if (img.startsWith('data:')) return img
  // Already a full URL
  if (img.startsWith('http')) return img
  // New API path - use as-is (relative URL)
  if (img.startsWith('/api/img/')) return img
  // Legacy /uploads/ path - convert to API path
  if (img.startsWith('/uploads/')) {
    return img.replace('/uploads/', '/api/img/')
  }
  // Fallback: prepend API_URL
  return `${API_URL}${img}`
}
