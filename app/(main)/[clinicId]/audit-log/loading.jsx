import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import { SidebarInset } from '@/components/ui/sidebar'

export default function Loading() {
  return (
    <SidebarInset>
      <Box sx={{ p: 3 }}>
        <Skeleton variant="rectangular" width={140} height={28} sx={{ mb: 3, borderRadius: 1 }} />
        <Skeleton variant="rectangular" height={56} sx={{ mb: 2, borderRadius: 1 }} />
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} variant="rectangular" height={48} sx={{ mb: 1, borderRadius: 1 }} />
        ))}
      </Box>
    </SidebarInset>
  )
}
