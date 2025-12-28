/**
 * Color picker field with preview
 *
 * @param {object} props
 * @param {string} props.label - Field label
 * @param {string} props.value - Current color value
 * @param {function} props.onChange - Color change handler
 * @param {Array} props.presets - Optional preset colors
 */
export default function ColorPickerField({
  label = 'Couleur',
  value = '#3B82F6',
  onChange,
  presets = [
    '#EF4444', '#F97316', '#F59E0B', '#84CC16',
    '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6',
    '#6366F1', '#8B5CF6', '#A855F7', '#EC4899'
  ]
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>

      <div className="flex items-center gap-3">
        {/* Color input */}
        <div className="relative">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-200 dark:border-gray-600"
          />
        </div>

        {/* Preview circle */}
        <div
          className="w-10 h-10 rounded-full border-2 border-white dark:border-gray-600 shadow-md"
          style={{ backgroundColor: value }}
        />

        {/* Hex value */}
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const hex = e.target.value
            if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
              onChange(hex)
            }
          }}
          className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm font-mono uppercase"
          placeholder="#000000"
        />
      </div>

      {/* Presets */}
      {presets.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {presets.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onChange(color)}
              className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                value === color ? 'border-gray-900 dark:border-white scale-110' : 'border-white dark:border-gray-600 shadow-sm'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
