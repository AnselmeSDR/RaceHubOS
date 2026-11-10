import { Suspense } from 'react'
import { useLocation } from 'react-router-dom'
import AddonErrorBoundary from './AddonErrorBoundary'

/** One add-on page: lazy-loaded, and isolated by its error boundary (reset on navigation). */
export default function AddonPage({ addonId, Component }) {
  const { pathname } = useLocation()
  return (
    <AddonErrorBoundary key={pathname} addonId={addonId}>
      <Suspense>
        <Component />
      </Suspense>
    </AddonErrorBoundary>
  )
}
