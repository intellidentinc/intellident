'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell } from 'lucide-react'
import NotificationDrawer from './NotificationDrawer'

export default function NotificationBell() {
  const [open, setOpen]           = useState(false)
  const [unreadCount, setUnread]  = useState(0)

  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) {
        const data = await res.json()
        setUnread(data.unreadCount ?? 0)
      }
    } catch { /* silent */ }
  }, [])

  // Initial fetch + poll every 30 seconds
  useEffect(() => {
    fetchCount()
    const interval = setInterval(fetchCount, 30_000)
    return () => clearInterval(interval)
  }, [fetchCount])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className='relative flex items-center justify-center h-9 w-9 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors'
        aria-label='Notifications'
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className='absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#2563eb] px-1 text-[9px] font-bold text-white leading-none'>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <NotificationDrawer
        open={open}
        onClose={() => setOpen(false)}
        onRead={fetchCount}
      />
    </>
  )
}
