import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'

const KEYS = {
  theme: 'racehubos-theme',
  admin: 'racehubos-admin',
  sidebar: 'racehubos-sidebar',
  standings: 'racehubos-show-standings',
}

function loadBool(key, defaultValue) {
  const stored = localStorage.getItem(key)
  return stored !== null ? stored === 'true' : defaultValue
}

const AppContext = createContext(null)

export function AppProvider({ children }) {
  // Theme
  const [isDark, setIsDark] = useState(() => localStorage.getItem(KEYS.theme) === 'dark')
  const [isAdmin, setIsAdmin] = useState(() => loadBool(KEYS.admin, false))

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem(KEYS.theme, 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem(KEYS.theme, 'light')
    }
  }, [isDark])

  useEffect(() => {
    localStorage.setItem(KEYS.admin, isAdmin)
  }, [isAdmin])

  const toggleTheme = useCallback(() => setIsDark(prev => !prev), [])
  const toggleAdmin = useCallback(() => setIsAdmin(prev => !prev), [])

  // Sidebar
  const [sidebarPref, setSidebarPref] = useState(() => loadBool(KEYS.sidebar, true))

  const setSidebarOpen = useCallback((value) => {
    const next = typeof value === 'function' ? value(sidebarPref) : value
    setSidebarPref(next)
    localStorage.setItem(KEYS.sidebar, next)
  }, [sidebarPref])

  // Standings
  const [standingsPref, setStandingsPref] = useState(() => loadBool(KEYS.standings, true))

  const toggleStandings = useCallback(() => {
    setStandingsPref(prev => {
      const next = !prev
      localStorage.setItem(KEYS.standings, next)
      return next
    })
  }, [])

  // Race override: SessionContext calls setSessionActive
  const [sessionActive, setSessionActive] = useState(false)
  const wasActiveRef = useRef(false)

  const sidebarOpen = sessionActive ? false : sidebarPref
  const showStandings = sessionActive ? false : standingsPref

  useEffect(() => {
    if (sessionActive) {
      wasActiveRef.current = true
    } else if (wasActiveRef.current) {
      wasActiveRef.current = false
      setStandingsPref(true)
    }
  }, [sessionActive])

  return (
    <AppContext.Provider value={{
      // Theme
      isDark, toggleTheme,
      isAdmin, toggleAdmin,
      // Sidebar
      sidebarOpen, setSidebarOpen,
      // Standings
      showStandings, toggleStandings,
      // Session active (called by SessionContext)
      setSessionActive,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used within AppProvider')
  return context
}
