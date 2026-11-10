import { useState } from 'react'

/** A number kept in the browser under `key`, null when unset; setting it to a falsy value forgets it. */
export function useStoredNumber(key) {
  const [value, setValue] = useState(() => {
    const stored = localStorage.getItem(key)
    return stored ? parseInt(stored) : null
  })

  function store(next) {
    setValue(next)
    if (next) localStorage.setItem(key, next)
    else localStorage.removeItem(key)
  }

  return [value, store]
}
