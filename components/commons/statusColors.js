/**
 * statusColors — single source of truth for appointment status chip styling.
 *
 * Previously these color literals were duplicated across DashboardClients,
 * AppointmentsPage, and others. Import STATUS_CHIP for the raw map, or use the
 * <StatusChip status={...} /> helper for a ready-to-render MUI Chip.
 */
'use client'

import Chip from '@mui/material/Chip'

export const STATUS_CHIP = {
  PENDING:     { bg: '#fef9c3', color: '#854d0e', label: 'Pending' },
  CONFIRMED:   { bg: '#dbeafe', color: '#1d4ed8', label: 'Confirmed' },
  COMPLETED:   { bg: '#dcfce7', color: '#15803d', label: 'Completed' },
  CANCELLED:   { bg: '#fee2e2', color: '#b91c1c', label: 'Cancelled' },
  NO_SHOW:     { bg: '#f1f5f9', color: '#475569', label: 'No-show' },
  RESCHEDULED: { bg: '#ede9fe', color: '#7c3aed', label: 'Rescheduled' },
}

const FALLBACK = { bg: '#f1f5f9', color: '#475569', label: '' }

/** Returns the {bg, color, label} descriptor for a status (with a safe fallback). */
export function getStatusChip(status) {
  return STATUS_CHIP[status] ?? { ...FALLBACK, label: status ?? 'Unknown' }
}

/** Ready-to-render MUI status Chip. */
export default function StatusChip({ status, size = 'small', sx, ...props }) {
  const chip = getStatusChip(status)
  return (
    <Chip
      label={chip.label}
      size={size}
      sx={{ bgcolor: chip.bg, color: chip.color, fontWeight: 600, ...sx }}
      {...props}
    />
  )
}
