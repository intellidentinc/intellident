import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'
import { SidebarInset } from '@/components/ui/sidebar'

export default function Loading() {
  return (
    <SidebarInset>
      <Box sx={{ p: 3 }}>
        <Skeleton variant="rectangular" width={160} height={28} sx={{ mb: 3, borderRadius: 1 }} />
        <Skeleton variant="rectangular" height={480} sx={{ borderRadius: 2 }} />
      </Box>
    </SidebarInset>
  )
}
