import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'

/** A block of the home page: its title, a link to the page that says more, then its content. */
export default function Panel({ title, to, link, testId, className = '', children }) {
  return (
    <Card data-testid={testId} className={className}>
      <CardContent className="flex h-full flex-col p-0">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">{title}</h2>
          {to && (
            <Link to={to} className="text-xs text-muted-foreground hover:text-foreground">
              {link}
            </Link>
          )}
        </div>
        {children}
      </CardContent>
    </Card>
  )
}
