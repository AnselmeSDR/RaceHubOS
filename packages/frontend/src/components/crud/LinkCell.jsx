/** A table cell opening `to` through `onOpen(to)`, without selecting the row. */
export default function LinkCell({ to, onOpen, className, children }) {
  return (
    <div
      className={className}
      onClick={(e) => {
        e.stopPropagation()
        onOpen(to)
      }}
    >
      {children}
    </div>
  )
}
