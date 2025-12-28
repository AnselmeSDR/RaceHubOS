import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext(null)

const THEME_KEY = 'racehubos-theme'
const ADMIN_KEY = 'racehubos-admin'

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem(THEME_KEY)
    return stored === 'dark'
  })

  const [isAdmin, setIsAdmin] = useState(() => {
    const stored = localStorage.getItem(ADMIN_KEY)
    return stored === 'true'
  })

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem(THEME_KEY, 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem(THEME_KEY, 'light')
    }
  }, [isDark])

  useEffect(() => {
    localStorage.setItem(ADMIN_KEY, isAdmin ? 'true' : 'false')
  }, [isAdmin])

  const toggleTheme = () => setIsDark(prev => !prev)
  const toggleAdmin = () => setIsAdmin(prev => !prev)

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, isAdmin, toggleAdmin }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

export default ThemeContext
