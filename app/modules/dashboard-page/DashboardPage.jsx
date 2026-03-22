import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import SignOutButton from './SignOutButton';

export default async function DashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect('/signin');
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F8FAFC' }}>
      <Box component="nav" sx={{ bgcolor: 'white', borderBottom: '1px solid #e3f0ff', boxShadow: 1 }}>
        <Box sx={{ maxWidth: 1280, mx: 'auto', px: { xs: 2, sm: 3, lg: 4 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 64 }}>
            <Typography variant="h6" fontWeight={700} color="primary">
              Dashboard
            </Typography>
            <SignOutButton />
          </Box>
        </Box>
      </Box>

      <Box sx={{ maxWidth: 1280, mx: 'auto', px: { xs: 2, sm: 3, lg: 4 }, py: 6 }}>
        <Paper elevation={3} sx={{ p: 4, borderRadius: 3 }}>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h4" fontWeight={700} color="text.primary">
              Welcome back{session.name ? `, ${session.name}` : ''}!
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
    </Box>
  );
}
