import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import { SidebarInset } from '@/components/ui/sidebar'

export default function Loading() {
  return (
    <SidebarInset>
      <Box sx={{ p: 3 }}>
        <Skeleton variant="rectangular" width={200} height={28} sx={{ mb: 3, borderRadius: 1 }} />
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} variant="rectangular" width={80} height={34} sx={{ borderRadius: 1 }} />
          ))}
        </Box>
        <Skeleton variant="rectangular" height={480} sx={{ borderRadius: 2 }} />
      </Box>
    </SidebarInset>
  )
}
