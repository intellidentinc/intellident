import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';

export default async function DashboardPage({ session }) {
  return (
    <SidebarInset>
      <header className="flex h-14 items-center gap-3 border-b bg-white px-4">
        <SidebarTrigger />
        <div className="h-5 w-px bg-gray-200" />
        <span className="font-semibold text-slate-700">Dashboard</span>
      </header>

      <Box sx={{ p: { xs: 2, sm: 3, lg: 4 } }}>
        <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h4" fontWeight={700} color="text.primary">
              Welcome back{session.firstName ? `, ${session.firstName}` : ''}!
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
              Email: {session.email}
            </Typography>
          </Box>

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Paper variant="outlined" sx={{ p: 3, bgcolor: '#eff6ff', borderColor: '#bfdbfe' }}>
                <Typography variant="subtitle1" fontWeight={600} color="primary.dark" gutterBottom>
                  Account Info
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  User ID: {session.userId}
                </Typography>
              </Paper>
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <Paper variant="outlined" sx={{ p: 3, bgcolor: '#eff6ff', borderColor: '#bfdbfe' }}>
                <Typography variant="subtitle1" fontWeight={600} color="primary.dark" gutterBottom>
                  Status
                </Typography>
                <Typography variant="body2" color="success.main" fontWeight={600}>
                  Active
                </Typography>
              </Paper>
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <Paper variant="outlined" sx={{ p: 3, bgcolor: '#eff6ff', borderColor: '#bfdbfe' }}>
                <Typography variant="subtitle1" fontWeight={600} color="primary.dark" gutterBottom>
                  Quick Actions
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Coming soon...
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          <Box sx={{ mt: 4, p: 3, borderRadius: 2, background: 'linear-gradient(to right, #3b82f6, #2563eb)' }}>
            <Typography variant="h6" fontWeight={600} color="white" gutterBottom>
              Getting Started
            </Typography>
            <Typography variant="body2" sx={{ color: '#bfdbfe' }}>
              Your authentication system is now set up! You can customize this dashboard to fit your needs.
            </Typography>
          </Box>
        </Paper>
      </Box>
    </SidebarInset>
  );
}
