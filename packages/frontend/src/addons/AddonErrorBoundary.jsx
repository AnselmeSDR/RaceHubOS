import { Component } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

function AddonCrash({ addonId, error, onRetry }) {
  const { t } = useTranslation('addons')
  return (
    <Card className="m-6 border-destructive/50" data-testid="addon-error">
      <CardContent className="flex flex-col gap-3 p-6">
        <div className="flex items-center gap-2 font-semibold text-destructive">
          <AlertTriangle className="size-5" />
          {t('error.title', { addon: addonId })}
        </div>
        <p className="text-sm text-muted-foreground">{t('error.hint')}</p>
        <pre className="overflow-auto rounded bg-muted p-3 text-xs">{String(error?.message ?? error)}</pre>
        <div>
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCcw className="size-4" />
            {t('error.retry')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

/** Keeps a crashing add-on page from taking the whole app down. */
export default class AddonErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    console.error(`[addon:${this.props.addonId}] page crashed:`, error)
  }

  retry = () => this.setState({ error: null })

  render() {
    if (this.state.error) {
      return <AddonCrash addonId={this.props.addonId} error={this.state.error} onRetry={this.retry} />
    }
    return this.props.children
  }
}
