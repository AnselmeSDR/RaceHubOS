import { useState } from 'react'
import { SessionType } from '@racehubos/shared'

/** The standings tab shown: free to change, it follows the type of the selected session when that changes. */
export function useStandingsTab(sessionType) {
  const [tab, setTab] = useState(SessionType.PRACTICE)
  const [followedType, setFollowedType] = useState(undefined)
  if (sessionType !== followedType) {
    setFollowedType(sessionType)
    if (sessionType) setTab(sessionType)
  }
  return [tab, setTab]
}
