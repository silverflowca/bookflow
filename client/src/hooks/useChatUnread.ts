import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../lib/api'

// Returns { [clubId]: unreadCount } for all the user's clubs
export function useChatUnread(enabled = true) {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    try {
      const data = await api.getClubChatUnreadAll()
      setCounts(data)
    } catch (_) {}
  }, [])

  useEffect(() => {
    if (!enabled) return
    refresh()
    intervalRef.current = setInterval(refresh, 30_000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [enabled, refresh])

  const clearClub = useCallback((clubId: string) => {
    setCounts(prev => ({ ...prev, [clubId]: 0 }))
  }, [])

  const totalUnread = Object.values(counts).reduce((a, b) => a + b, 0)

  return { counts, totalUnread, refresh, clearClub }
}
