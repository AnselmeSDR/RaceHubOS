import { Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import addons from 'virtual:racehubos-addons'
import AddonPage from './addons/AddonPage'
import { addonRoutes } from './addons/registry'
import Layout from './components/Layout'
import { PAGE_ROUTES } from './pageRoutes'

// Pages brought by add-ons — docs/ADDONS.md § Web side
const addonPages = addonRoutes(addons)
const addonRoute = (route) => (
  <Route
    key={route.key}
    path={route.path}
    element={<AddonPage addonId={route.addonId} Component={route.Component} />}
  />
)

const pageRoute = ({ path, Page }) => (
  <Route
    key={path}
    index={!path}
    path={path || undefined}
    element={
      <Suspense>
        <Page />
      </Suspense>
    }
  />
)

/** The core pages and the add-ons' in the app's frame, the add-on pages that want none, home for the rest. */
export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        {PAGE_ROUTES.map(pageRoute)}
        {addonPages.filter((route) => route.layout).map(addonRoute)}
      </Route>
      {addonPages.filter((route) => !route.layout).map(addonRoute)}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
