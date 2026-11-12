import { cn } from '@/lib/utils'
import { getImgUrl } from '@/utils/image'

/**
 * The layer every uploaded picture sits in: a square with corners rounded to 20 % of its side, without
 * border, ring, shadow or colour behind (the file carries its own background, transparent or plain).
 * Without a picture, the record's colour fills it and `children` (initial, icon, name) sit on it,
 * sized in `cqw` to follow the layer. `fit="contain"` shows a picture that is not square whole.
 */
export default function PictureLayer({ img, color, alt = '', fit = 'cover', className = 'size-8', children }) {
  const src = getImgUrl(img)
  return (
    <span
      className={cn(
        '@container inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[20%] font-bold leading-none text-white',
        className
      )}
      style={src ? undefined : { backgroundColor: color || '#3B82F6' }}
    >
      {src ? (
        <img src={src} alt={alt} className={cn('size-full', fit === 'contain' ? 'object-contain' : 'object-cover')} />
      ) : (
        children
      )}
    </span>
  )
}
