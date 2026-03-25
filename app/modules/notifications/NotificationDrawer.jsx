'use client'

import { useEffect, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import CloseIcon from '@mui/icons-material/Close'
import DoneAllIcon from '@mui/icons-material/DoneAll'
import {
  CalendarDays, CheckCircle, XCircle, CheckCircle2, AlertCircle, Bell,
} from 'lucide-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

const TYPE_CONFIG = {
  BOOKING_REQUEST: {
    icon: CalendarDays,
    color: '#d97706',
    bg: '#fef9c3',
    label: 'New Booking Request',
  },
  APPOINTMENT_CONFIRMED: {
    icon: CheckCircle,
    color: '#15803d',
    bg: '#dcfce7',
    label: 'Appointment Confirmed',
  },
  APPOINTMENT_CANCELLED: {
    icon: XCircle,
    color: '#b91c1c',
    bg: '#fee2e2',
    label: 'Appointment Cancelled',
  },
  APPOINTMENT_COMPLETED: {
    icon: CheckCircle2,
    color: '#1d4ed8',
    bg: '#dbeafe',
    label: 'Appointment Completed',
  },
  APPOINTMENT_NO_SHOW: {
    icon: AlertCircle,
    color: '#475569',
    bg: '#f1f5f9',
    label: 'Patient No-show',
  },
}

export default function NotificationDrawer({ open, onClose, onRead }) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchNotifs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) fetchNotifs()
  }, [open, fetchNotifs])

  async function markOne(id) {
    await fetch(`/api/notifications/${id}`, { method: 'PATCH' })
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n))
    onRead?.()
  }

  async function markAll() {
    await fetch('/api/notifications', { method: 'PATCH' })
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    onRead?.()
  }

  const unread = notifications.filter((n) => !n.isRead).length

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key='backdrop'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0,
              backgroundColor: 'rgba(0,0,0,0.25)',
              zIndex: 1200,
            }}
          />

          {/* Drawer */}
          <motion.div
            key='drawer'
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: 380,
              maxWidth: '100vw',
              backgroundColor: '#fff',
              zIndex: 1201,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
            }}
          >
            {/* Header */}
            <Box sx={{ px: 2.5, py: 2, display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
              <Bell size={18} color='#2563eb' />
              <Typography variant='subtitle1' fontWeight={700} color='text.primary' sx={{ flex: 1 }}>
                Notifications
              </Typography>
              {unread > 0 && (
                <Box sx={{ px: 1, py: 0.25, bgcolor: '#2563eb', borderRadius: 10, mr: 0.5 }}>
                  <Typography variant='caption' sx={{ color: '#fff', fontWeight: 700, fontSize: '0.7rem' }}>
                    {unread} new
                  </Typography>
                </Box>
              )}
              {unread > 0 && (
                <IconButton size='small' onClick={markAll} title='Mark all as read' sx={{ color: '#2563eb' }}>
                  <DoneAllIcon fontSize='small' />
                </IconButton>
              )}
              <IconButton size='small' onClick={onClose} sx={{ color: '#64748b' }}>
                <CloseIcon fontSize='small' />
              </IconButton>
            </Box>

            {/* Content */}
            <Box sx={{ flex: 1, overflowY: 'auto' }}>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
                  <CircularProgress size={28} sx={{ color: '#2563eb' }} />
                </Box>
              ) : notifications.length === 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 8, px: 3, gap: 1 }}>
                  <Bell size={36} color='#cbd5e1' />
                  <Typography variant='body2' color='text.disabled' sx={{ textAlign: 'center' }}>
                    No notifications yet
                  </Typography>
                </Box>
              ) : (
                notifications.map((notif, i) => {
                  const cfg = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.BOOKING_REQUEST
                  const Icon = cfg.icon
                  return (
                    <Box key={notif.id}>
                      <Box
                        onClick={() => { if (!notif.isRead) markOne(notif.id) }}
                        sx={{
                          display: 'flex',
                          gap: 1.5,
                          px: 2.5,
                          py: 1.75,
                          cursor: notif.isRead ? 'default' : 'pointer',
                          bgcolor: notif.isRead ? 'transparent' : '#f8faff',
                          '&:hover': { bgcolor: '#f1f5f9' },
                          transition: 'background 0.15s',
                          position: 'relative',
                        }}
                      >
                        {/* Unread dot */}
                        {!notif.isRead && (
                          <Box sx={{ position: 'absolute', top: 14, left: 10, width: 7, height: 7, borderRadius: '50%', bgcolor: '#2563eb' }} />
                        )}
                        {/* Icon */}
                        <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.25 }}>
                          <Icon size={18} color={cfg.color} />
                        </Box>
                        {/* Text */}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant='body2' fontWeight={notif.isRead ? 400 : 700} color='text.primary' sx={{ lineHeight: 1.4 }}>
                            {notif.title}
                          </Typography>
                          <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 0.25, lineHeight: 1.4 }}>
                            {notif.body}
                          </Typography>
                          <Typography variant='caption' sx={{ color: '#94a3b8', mt: 0.5, display: 'block' }}>
                            {dayjs(notif.createdAt).fromNow()}
                          </Typography>
                        </Box>
                      </Box>
                      {i < notifications.length - 1 && <Divider sx={{ mx: 2.5 }} />}
                    </Box>
                  )
                })
              )}
            </Box>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
