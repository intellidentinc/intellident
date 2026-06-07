import { SidebarInset } from '@/components/ui/sidebar'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import ApplicationsTab from '@/app/modules/super-page/ApplicationsTab'
import SuperPageHeader from '@/app/modules/super-page/SuperPageHeader'

export const metadata = { title: 'Applications | IntelliDent Super Admin' }

export default function Page() {
  return (
    <SidebarInset>
      <SuperPageHeader title='Clinic Applications' />
      <Box sx={{ px: { xs: 3, sm: 5 }, py: 5, maxWidth: 1100, mx: 'auto', width: '100%' }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant='h5' fontWeight={700} color='text.primary' mb={0.5}>
            Clinic Applications
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            Review and approve or reject pending clinic registration requests.
          </Typography>
        </Box>
        <ApplicationsTab />
      </Box>
    </SidebarInset>
  )
}
