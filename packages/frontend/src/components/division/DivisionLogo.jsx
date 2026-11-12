import PictureLayer from '@/components/picture/PictureLayer'
import { divisionColor, textOn } from '@/lib/colors'

/** A division's logo in the common layer, or its short name on its colour, sized to fit whole. */
export default function DivisionLogo({ division, className = 'size-20' }) {
  const color = divisionColor(division)
  const label = division.shortName || division.name
  return (
    <PictureLayer img={division.img} color={color} className={className}>
      <span
        className="px-[4cqw] text-center font-black"
        style={{ color: textOn(color), fontSize: `${Math.min(30, 115 / label.length)}cqw` }}
      >
        {label}
      </span>
    </PictureLayer>
  )
}
