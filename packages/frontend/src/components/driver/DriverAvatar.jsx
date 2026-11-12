import PictureLayer from '@/components/picture/PictureLayer'
import { driverColor } from '@/lib/colors'

/**
 * A driver's picture in the common layer, or on their colour `label` (their initial by default),
 * sized to fit whole.
 */
export default function DriverAvatar({ driver, label, alt = '', className = 'size-8' }) {
  const text = String(label ?? driver.name?.charAt(0) ?? '')
  return (
    <PictureLayer img={driver.img} color={driverColor(driver)} alt={alt} className={className}>
      <span style={{ fontSize: `${Math.min(42, 100 / Math.max(1, text.length))}cqw` }}>{text}</span>
    </PictureLayer>
  )
}
