'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import { Eye, EyeOff } from 'lucide-react';
import Button from '@/components/commons/Button';
import Input from '@/components/commons/Input';
import { useToast } from '@/app/providers/ToastProvider';
import { useCrypto } from '@/app/providers/CryptoProvider';
import { loadOrProvisionKeys } from '@/lib/clientKeys';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const { setKeys } = useCrypto();

  useEffect(() => {
    const verified = searchParams.get('verified');
    const reason   = searchParams.get('reason');

    if (reason === 'inactivity') {
      showToast('You were signed out due to inactivity.', 'warning');
      return;
    }


    if (!verified) return;
    const messages = {
      success: ['Email verified! You can now sign in.', 'success'],
      expired: ['Verification link has expired. Please sign up again.', 'error'],
      invalid: ['Invalid verification link.', 'error'],
      already: ['Account already verified. Please sign in.', 'info'],
      error:   ['Verification failed. Please try again.', 'error'],
    };
    const [msg, severity] = messages[verified] ?? ['Unknown verification status.', 'warning'];
    showToast(msg, severity);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/auth/sign-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, rememberMe }),
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(data.error || 'Something went wrong', 'error');
        setLoading(false);
        return;
      }

      // MFA (OTP) gate — credentials valid, but a one-time code is required before any session
      // exists. Stash only the password; the server releases the E2EE key material
      // (wrappedKey/keySalt) after the OTP is verified, not before.
      if (data.mfaPending) {
        sessionStorage.setItem('mfa_pending', JSON.stringify({ password }));
        router.push(`/verify-otp?token=${data.pendingToken}`);
        return;
      }

      // Unwrap the master key + load/provision the envelope keypair client-side
      const keys = await loadOrProvisionKeys(data, password);
      setKeys(keys);
      showToast('Signed in successfully!', 'success');
      if (data.requiresTerms) {
        const params = new URLSearchParams()
        if (data.clinicId) params.set('clinicId', data.clinicId)
        if (data.mustChangePassword) params.set('mustChange', '1')
        router.push(`/accept-terms?${params.toString()}`);
        return;
      }
      if (data.mustChangePassword) {
        router.push('/change-password?reason=first-login');
        return;
      }
      if (data.passwordExpired) {
        router.push('/change-password?reason=expired');
        return;
      }
      if (data.requiresStepUp) {
        const dest = data.clinicId ? `/${data.clinicId}/dashboard` : '/super';
        router.push(`/step-up?redirect=${encodeURIComponent(dest)}`);
        return;
      }
      router.push(data.clinicId ? `/${data.clinicId}/dashboard` : '/super');
    } catch (err) {
      // Clear any session the server may have already set so refresh doesn't leave the user
      // in a broken logged-in state without a master key in memory.
      fetch('/api/auth/sign-out', { method: 'POST' }).catch(() => {});
      showToast('Failed to sign in. Please try again.', 'error');
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2, bgcolor: 'background.default' }}>
      <Box sx={{ width: '100%', maxWidth: 440 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="h4" fontWeight={700} color="primary">
            Welcome Back
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Sign in to your account
          </Typography>
        </Box>

        <Paper elevation={3} sx={{ p: 4 }}>
          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Input
              id="email"
              label="Email Address"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />

            <Box>
              <Input
                id="password"
                label="Password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                endAdornment={
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword((v) => !v)}
                      edge="end"
                      size="small"
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </IconButton>
                  </InputAdornment>
                }
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                <Link href="/forgot-password" style={{ color: '#2563eb', fontWeight: 500, fontSize: 13 }}>
                  Forgot password?
                </Link>
              </Box>
            </Box>

            <FormControlLabel
              control={
                <Checkbox
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  size="small"
                />
              }
              label={
                <Typography variant="body2" color="text.secondary">
                  Remember this device for 3 days
                </Typography>
              }
            />

            <Button type="submit" variant="contained" size="large" loading={loading} fullWidth>
              Sign In
            </Button>
          </Box>

          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Don&apos;t have an account?{' '}
              <Link href="/sign-up" style={{ color: '#2563eb', fontWeight: 600 }}>
                Sign Up
              </Link>
            </Typography>
          </Box>
        </Paper>

        <Box sx={{ mt: 3, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Link href="/" style={{ color: '#2563eb', fontWeight: 600, fontSize: 14 }}>
            ← Back to Home
          </Link>
          <Typography variant="caption" color="text.secondary">
            Need help? Contact us at{' '}
            <span style={{ color: '#2563eb', fontWeight: 600 }}>intellident.inc@gmail.com</span>
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
