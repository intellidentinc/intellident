/**
 * StatCard — reusable dashboard stat tile.
 *
 * Features: animated count-up, optional icon with tinted accent, urgent variant,
 * optional href (renders as a link), optional trend/sub line. Designed to be the
 * single stat-card implementation across all dashboards.
 */
'use client'

import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { colors, shadows, radii } from './theme'

export function useCounter(target, duration = 800) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!target) { setCount(0); return }
    const start = performance.now()
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setCount(Math.floor(eased * target))
      if (p < 1) requestAnimationFrame(tick)
      else setCount(target)
    }
    const raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return count
}

export default function StatCard({
  label,
  value = 0,
  icon: Icon,
  href,
  urgent = false,
  accent = colors.primaryBlue,
  accentBg = colors.paleBlue,
  sub,
  animate = true,
}) {
  const animated = useCounter(animate ? value : 0)
  const display = animate ? animated : value
  const isUrgent = urgent && value > 0

  const inner = (
    <Box
      sx={{
        position: 'relative',
        bgcolor: '#fff',
        border: '1px solid',
        borderColor: isUrgent ? '#fde68a' : colors.border,
        borderLeft: isUrgent ? '3px solid #d97706' : undefined,
        borderRadius: `${radii.lg}px`,
        p: 2.5,
        height: '100%',
        overflow: 'hidden',
        transition: 'border-color 0.18s, box-shadow 0.18s, transform 0.18s',
        '&:hover': href ? {
          borderColor: isUrgent ? '#fbbf24' : colors.borderStrong,
          boxShadow: shadows.hover,
          transform: 'translateY(-2px)',
        } : undefined,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant='h4'
            sx={{ lineHeight: 1, mb: 0.75, color: isUrgent ? '#b45309' : colors.ink }}
          >
            {display}
          </Typography>
          <Typography variant='body2' sx={{ color: colors.muted }} noWrap>{label}</Typography>
          {sub && (
            <Typography variant='caption' sx={{ color: colors.faint, display: 'block', mt: 0.25 }}>{sub}</Typography>
          )}
        </Box>
        {Icon && (
          <Box
            sx={{
              flexShrink: 0,
              width: 40, height: 40,
              borderRadius: `${radii.md}px`,
              bgcolor: isUrgent ? '#fffbeb' : accentBg,
              color: isUrgent ? '#d97706' : accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Icon size={20} />
          </Box>
        )}
      </Box>
    </Box>
  )

  if (href) {
    return (
      <Box component='a' href={href} sx={{ textDecoration: 'none', display: 'block', height: '100%' }}>
        {inner}
      </Box>
    )
  }
  return inner
}
