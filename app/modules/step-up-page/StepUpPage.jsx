'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Alert from '@mui/material/Alert';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Button from '@/components/commons/Button';
import Input from '@/components/commons/Input';
import { useToast } from '@/app/providers/ToastProvider';

export default function StepUpPage() {
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const router      = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const redirect = searchParams.get('redirect') || '/';

  async function handleSubmit(e) {
    e.preventDefault();
    if (!password) { setError('Password is required'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/step-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        showToast('Identity verified. Continuing...', 'success');
        router.push(redirect);
      } else {
        const data = await res.json();
        setError(data.error ?? 'Verification failed');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2, bgcolor: 'background.default' }}>
      <Box sx={{ width: '100%', maxWidth: 440 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box
            sx={{
              width: 56, height: 56, borderRadius: 3, bgcolor: '#eff6ff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2,
            }}
          >
            <LockOutlinedIcon sx={{ fontSize: 28, color: '#2563eb' }} />
          </Box>
          <Typography variant="h5" fontWeight={700} color="text.primary">
            Verify Your Identity
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            We detected a sign-in from a new or unfamiliar device. Please re-enter your password to continue.
          </Typography>
        </Box>

        <Paper elevation={3} sx={{ p: 4 }}>
          <Alert severity="warning" sx={{ mb: 3, fontSize: '0.8125rem' }}>
            If this wasn&apos;t you, please change your password immediately.
          </Alert>

          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Input
              id="step-up-password"
              label="Password"
              type="password"
              required
              autoFocus
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="Enter your current password"
              error={!!error}
              helperText={error}
            />

            <Button type="submit" variant="contained" size="large" loading={loading} fullWidth>
              Verify and Continue
            </Button>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
