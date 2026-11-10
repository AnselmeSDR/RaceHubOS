import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

const API_URL = import.meta.env.VITE_API_URL || ''
const PAGE_SIZE = 50

/** One page of `endpoint` (`{ data, hasMore, total }`), or null when it can't be read. */
async function fetchPage(endpoint, { query, showDeleted, sort }, offset) {
  const params = new URLSearchParams(query)
  if (showDeleted) params.append('deleted', 'true')
  if (sort) {
    params.append('sortBy', sort.id)
    params.append('sortOrder', sort.desc ? 'desc' : 'asc')
  }
  params.append('offset', String(offset))
  params.append('limit', String(PAGE_SIZE))
  try {
    const res = await fetch(`${API_URL}${endpoint}?${params}`)
    const page = await res.json()
    return page.success ? page : null
  } catch (err) {
    console.error(`Failed to load ${endpoint}:`, err)
    return null
  }
}

/**
 * A list read 50 records at a time from `endpoint`, with the "show deleted" option and the column sort.
 * `params` are more query parameters (filters), as an object of strings.
 *
 * Changing any of them reloads from the start; the loading screen only shows the first time, so the
 * list doesn't flash. `listProps` are the matching props of `ListPage`.
 */
export function usePagedList(endpoint, params) {
  const { t } = useTranslation('common')
  // Compared as a string, so a new object with the same filters doesn't reload
  const query = new URLSearchParams(params).toString()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [sort, setSort] = useState(null)
  const [showDeleted, setShowDeleted] = useState(false)
  const [reloads, setReloads] = useState(0)

  useEffect(() => {
    fetchPage(endpoint, { query, showDeleted, sort }, 0).then((page) => {
      if (page) {
        setItems(page.data)
        setHasMore(page.hasMore ?? false)
        setTotalCount(page.total ?? 0)
      }
      setLoading(false)
    })
  }, [endpoint, query, showDeleted, sort, reloads])

  function loadMore() {
    setLoadingMore(true)
    fetchPage(endpoint, { query, showDeleted, sort }, items.length).then((page) => {
      if (page) {
        setItems((prev) => [...prev, ...page.data])
        setHasMore(page.hasMore ?? false)
      }
      setLoadingMore(false)
    })
  }

  const reload = () => setReloads((n) => n + 1)

  return {
    items,
    showDeleted,
    reload,
    listProps: {
      data: items,
      totalCount,
      loading,
      hasMore,
      loadingMore,
      onLoadMore: loadMore,
      onSortChange: setSort,
      onDeleted: reload,
      hasActiveFilters: showDeleted,
      rowClassName: () => (showDeleted ? 'opacity-50' : ''),
      options: [
        {
          key: 'deleted',
          label: t('showDeleted'),
          checked: showDeleted,
          onChange: (v) => setShowDeleted(!!v),
        },
      ],
    },
  }
}
