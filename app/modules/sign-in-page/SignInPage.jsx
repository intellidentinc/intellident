'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@/components/commons/Button';
import Input from '@/components/commons/Input';
import { useToast } from '@/app/providers/ToastProvider';
import { useCrypto } from '@/app/providers/CryptoProvider';
import { deriveKEK, unwrapMasterKey, fromBase64 } from '@/lib/crypto';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const { setMasterKey } = useCrypto();

  useEffect(() => {
    const verified = searchParams.get('verified');
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
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(data.error || 'Something went wrong', 'error');
        setLoading(false);
        return;
      }

      // Unwrap the master key client-side using the password — server cannot do this
      const salt = fromBase64(data.keySalt);
      const kek = await deriveKEK(password, salt);
      const masterKey = await unwrapMasterKey(data.wrappedKey, kek);

      // Store master key in memory for the session
      setMasterKey(masterKey);
      showToast('Signed in successfully!', 'success');
      router.push(data.clinicId ? `/${data.clinicId}/dashboard` : '/dashboard');
    } catch (err) {
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

            <Input
              id="password"
              label="Password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
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
      </Box>
    </Box>
  );
}
