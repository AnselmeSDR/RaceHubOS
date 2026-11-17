/** A panel of the settings page: its title (after its `icon`), an optional `state` beside it, then its rows. */
export default function SettingsPanel({ title, icon, state, testId, children }) {
  return (
    <section data-testid={testId} className="overflow-hidden rounded-xl border border-border bg-card">
      <h2 className="flex items-center justify-between gap-3 px-4 py-3 text-sm font-semibold">
        <span className="flex items-center gap-2">
          {icon}
          {title}
        </span>
        {state}
      </h2>
      {children}
    </section>
  )
}

/** A row of a settings panel: its `icon`, what it sets, an optional line that explains it, then its control. */
export function SettingRow({ label, description, icon, sub = false, testId, children }) {
  return (
    <div
      data-testid={testId}
      className={`flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border py-2.5 pr-4 ${sub ? 'pl-8' : 'pl-4'}`}
    >
      <div className="flex min-w-0 flex-1 basis-40 items-center gap-3">
        {icon}
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}
