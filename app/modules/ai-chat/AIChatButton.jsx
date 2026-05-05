'use client'

import { useState } from 'react'
import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import { Bot } from 'lucide-react'
import AIChatDrawer from './AIChatDrawer'

export default function AIChatButton({ role }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Box sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1200 }}>
        <Tooltip title='IntelliDent AI Assistant' placement='left'>
          <Box
            onClick={() => setOpen(true)}
            sx={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              bgcolor: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(37,99,235,0.45)',
              transition: 'all 0.2s',
              '&:hover': { bgcolor: '#1d4ed8', transform: 'scale(1.08)', boxShadow: '0 6px 24px rgba(37,99,235,0.55)' },
            }}
          >
            <Bot size={24} color='#fff' />
          </Box>
        </Tooltip>
      </Box>

      <AIChatDrawer open={open} onClose={() => setOpen(false)} role={role} />
    </>
  )
}
