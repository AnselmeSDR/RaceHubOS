/** One card per part of the system (see `statusItems`): a green or red dot, its name and state. */
export default function StatusCards({ items }) {
  return (
    <div className="grid grid-cols-3 gap-2 px-4">
      {items.map((item) => (
        <div key={item.id} data-testid={`status-${item.id}`} className="rounded-lg border border-border p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <div
              data-testid="status-dot"
              className={`size-1.5 rounded-full ${item.ok ? 'bg-green-500' : 'bg-red-500'}`}
            />
            <span className="text-xs font-medium truncate">{item.label}</span>
          </div>
          <p className="text-[10px] text-muted-foreground">{item.detail}</p>
        </div>
      ))}
    </div>
  )
}
