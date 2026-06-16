/**
 * SectionCard — reusable bordered card with an optional header strip.
 *
 * Generalizes the header+body card pattern used in Settings and dashboards.
 * Pass `title` (+ optional `subtitle`, `icon`, `action`) for the header strip,
 * or omit them for a plain padded card. `noPadding` removes body padding (useful
 * for tables / lists that manage their own spacing).
 */
'use client'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { colors, shadows, radii } from './theme'

export default function SectionCard({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
  noPadding = false,
  sx,
}) {
  return (
    <Box
      sx={{
        bgcolor: '#fff',
        border: `1px solid ${colors.border}`,
        borderRadius: `${radii.lg}px`,
        boxShadow: shadows.sm,
        overflow: 'hidden',
        ...sx,
      }}
    >
      {title && (
        <Box
          sx={{
            display: 'flex', alignItems: 'center', gap: 1.5,
            px: 2.5, py: 1.75,
            borderBottom: `1px solid ${colors.border}`,
            bgcolor: colors.surface,
          }}
        >
          {Icon && (
            <Box
              sx={{
                flexShrink: 0, width: 32, height: 32,
                borderRadius: `${radii.sm}px`,
                bgcolor: colors.paleBlue, color: colors.primaryBlue,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Icon size={16} />
            </Box>
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant='subtitle2' sx={{ color: colors.ink }} noWrap>{title}</Typography>
            {subtitle && (
              <Typography variant='caption' sx={{ color: colors.faint }} noWrap>{subtitle}</Typography>
            )}
          </Box>
          {action}
        </Box>
      )}
      <Box sx={noPadding ? undefined : { p: 2.5 }}>{children}</Box>
    </Box>
  )
}
