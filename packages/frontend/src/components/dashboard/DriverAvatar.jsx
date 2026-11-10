import { getImgUrl } from '@/utils/image'

/** A driver's round picture, or their initial on their colour. */
export default function DriverAvatar({ driver, size = 'size-8' }) {
  return (
    <div
      className={`${size} rounded-full flex items-center justify-center text-white font-bold overflow-hidden shrink-0 ring-2 ring-background`}
      style={{ backgroundColor: driver.color || '#3B82F6' }}
    >
      {driver.img ? (
        <img src={getImgUrl(driver.img)} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="text-xs">{driver.name?.charAt(0)}</span>
      )}
    </div>
  )
}
