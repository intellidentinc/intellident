/**
 * PageContainer — standard page body wrapper for system pages.
 *
 * Provides consistent responsive padding + max width, and an optional hero
 * header block (title, subtitle, right-aligned action). Use inside SidebarInset
 * below <PageHeader />.
 */
'use client'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { colors } from './theme'

export default function PageContainer({
  title,
  subtitle,
  action,
  maxWidth = 1200,
  children,
  sx,
}) {
  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, ...sx }}>
      <Box sx={{ maxWidth, mx: 'auto' }}>
        {(title || action) && (
          <Box
            sx={{
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: 1.5, mb: 3.5,
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              {title && (
                <Typography variant='h5'>{title}</Typography>
              )}
              {subtitle && (
                <Typography variant='body2' sx={{ color: colors.faint, mt: 0.5 }}>{subtitle}</Typography>
              )}
            </Box>
            {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
          </Box>
        )}
        {children}
      </Box>
    </Box>
  )
}
