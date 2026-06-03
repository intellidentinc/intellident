import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import { SidebarInset } from '@/components/ui/sidebar'

export default function Loading() {
  return (
    <SidebarInset>
      <Box sx={{ p: 3 }}>
        <Skeleton variant="rectangular" width={140} height={28} sx={{ mb: 3, borderRadius: 1 }} />
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rectangular" height={90} sx={{ flex: 1, borderRadius: 2 }} />
          ))}
        </Box>
        <Skeleton variant="rectangular" height={320} sx={{ borderRadius: 2 }} />
      </Box>
    </SidebarInset>
  )
}
