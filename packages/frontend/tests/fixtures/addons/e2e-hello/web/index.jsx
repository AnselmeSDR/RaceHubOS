import { lazy } from 'react'

const HelloPage = lazy(() => import('./HelloPage.jsx'))

function Crash() {
  throw new Error('e2e crash on purpose')
}

function Screen() {
  return <p data-testid="e2e-hello-screen">full screen</p>
}

export default {
  routes: [
    { path: '', component: HelloPage },
    { path: 'crash', component: Crash },
    { path: 'screen', component: Screen, layout: false },
  ],
  nav: [{ to: '', labelKey: 'nav' }],
}
