/**
 * ToastProvider — Global Snackbar Notification System
 *
 * Provides the useToast() hook to any component in the tree.
 * Renders a single MUI Snackbar/Alert anchored to the top-right corner.
 *
 * Usage:
 *   const { showToast } = useToast()
 *   showToast('Saved!', 'success')
 *   showToast('Something went wrong', 'error', 'Optional description')
 *
 * Severities: 'success' | 'error' | 'info' | 'warning'
 * Auto-hides after 4 seconds. Clickaway is intentionally disabled so the user
 * must read the message before it disappears on its own.
 */
'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'

const ToastContext = createContext(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context
}

export default function ToastProvider({ children }) {
  const [toast, setToast] = useState({
    open: false,
    message: '',
    description: '',
    severity: 'info'
  })

  const showToast = useCallback((message, severity = 'info', description = '') => {
    setToast({ open: true, message, description, severity })
  }, [])

  const handleClose = (_, reason) => {
    if (reason === 'clickaway') return
    setToast((prev) => ({ ...prev, open: false }))
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={handleClose}
          severity={toast.severity}
          variant='filled'
          sx={{ minWidth: 300, alignItems: 'flex-start' }}
        >
          <Typography variant='body2' fontWeight={600} lineHeight={1.4}>
            {toast.message}
          </Typography>
          {toast.description && (
            <Typography variant='caption' sx={{ opacity: 0.85, display: 'block', mt: 0.25 }}>
              {toast.description}
            </Typography>
          )}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  )
}
