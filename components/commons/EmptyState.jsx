/**
 * EmptyState — standardized empty / no-data placeholder.
 *
 * Renders a centered icon bubble, title, optional description, and optional CTA.
 */
'use client'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { colors, radii } from './theme'

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  sx,
}) {
  return (
    <Box
      sx={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', px: 3, py: 5, gap: 0.5,
        ...sx,
      }}
    >
      {Icon && (
        <Box
          sx={{
            width: 48, height: 48, mb: 1,
            borderRadius: `${radii.lg}px`,
            bgcolor: colors.surface, color: colors.faint,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon size={22} />
        </Box>
      )}
      {title && <Typography variant='subtitle2' sx={{ color: colors.slateText }}>{title}</Typography>}
      {description && (
        <Typography variant='body2' sx={{ color: colors.faint, maxWidth: 320 }}>{description}</Typography>
      )}
      {action && <Box sx={{ mt: 1.5 }}>{action}</Box>}
    </Box>
  )
}
