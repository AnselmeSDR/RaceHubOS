/** The on/off switch of a settings row; `color` is its background class when on. */
export default function SettingSwitch({ on, onToggle, color, label }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${on ? color : 'bg-muted'}`}
    >
      <span
        className={`inline-block size-4 transform rounded-full bg-white shadow-sm transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`}
      />
    </button>
  )
}
