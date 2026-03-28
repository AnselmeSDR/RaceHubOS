import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const PageHeaderContext = createContext(null)

export function PageHeaderProvider({ children }) {
  const [header, setHeader] = useState(null)
  const resetHeader = useCallback(() => setHeader(null), [])

  return (
    <PageHeaderContext.Provider value={{ header, setHeader, resetHeader }}>
      {children}
    </PageHeaderContext.Provider>
  )
}

export function usePageHeader() {
  return useContext(PageHeaderContext)
}

export function useSetPageHeader({ title, icon, color, loading, totalCount, viewMode, onViewModeChange, hasGrid, onAdd, addLabel }) {
  const { setHeader, resetHeader } = useContext(PageHeaderContext)

  useEffect(() => {
    setHeader({ title, icon, color, loading, totalCount, viewMode, onViewModeChange, hasGrid, onAdd, addLabel })
  }, [setHeader, title, color, loading, totalCount, viewMode, hasGrid, addLabel])

  useEffect(() => resetHeader, [resetHeader])
}
