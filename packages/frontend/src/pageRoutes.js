import { lazy } from 'react'

/** The core pages inside the app's frame, each loaded on first visit; an empty path is the home page. */
export const PAGE_ROUTES = [
  { path: '', Page: lazy(() => import('./pages/Dashboard')) },
  { path: 'race', Page: lazy(() => import('./pages/FreeSessionPage')) },
  { path: 'balancing', Page: lazy(() => import('./pages/BalancingPage')) },
  { path: 'championships', Page: lazy(() => import('./pages/Championships')) },
  { path: 'championships/:id', Page: lazy(() => import('./pages/ChampionshipDetail')) },
  { path: 'drivers', Page: lazy(() => import('./pages/Drivers')) },
  { path: 'drivers/:id', Page: lazy(() => import('./pages/DriverProfile')) },
  { path: 'cars', Page: lazy(() => import('./pages/Cars')) },
  { path: 'cars/:id', Page: lazy(() => import('./pages/CarProfile')) },
  { path: 'tracks', Page: lazy(() => import('./pages/Tracks')) },
  { path: 'tracks/:id', Page: lazy(() => import('./pages/TrackProfile')) },
  { path: 'teams', Page: lazy(() => import('./pages/Teams')) },
  { path: 'sessions', Page: lazy(() => import('./pages/SessionsList')) },
  { path: 'sessions/:id', Page: lazy(() => import('./pages/SessionDetail')) },
  { path: 'history', Page: lazy(() => import('./pages/SessionsList')) },
  { path: 'stats', Page: lazy(() => import('./pages/Stats')) },
  { path: 'settings', Page: lazy(() => import('./pages/Settings')) },
  { path: 'addons', Page: lazy(() => import('./pages/Addons')) },
  { path: 'displays', Page: lazy(() => import('./pages/Displays')) },
  { path: 'demo-displays', Page: lazy(() => import('./pages/DriverDisplayDemo')) },
  { path: 'test', Page: lazy(() => import('./pages/Test')) },
]
