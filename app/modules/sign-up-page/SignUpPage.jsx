'use client';

import { useState } from 'react';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@/components/commons/Button';
import Input from '@/components/commons/Input';
import { useToast } from '@/app/providers/ToastProvider';
import {
  generateSalt,
  generateMasterKey,
  deriveKEK,
  wrapMasterKey,
  toBase64,
} from '@/lib/crypto';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Generate key material client-side before sending anything to the server
      const salt = generateSalt();
      const masterKey = await generateMasterKey();
      const kek = await deriveKEK(password, salt);
      const wrappedKey = await wrapMasterKey(masterKey, kek);
      const keySalt = toBase64(salt);

      const response = await fetch('/api/auth/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, firstName, lastName, wrappedKey, keySalt }),
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(data.error || 'Something went wrong', 'error');
        setLoading(false);
        return;
      }

      setSubmitted(true);
    } catch (err) {
      showToast('Failed to sign up. Please try again.', 'error');
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2, bgcolor: 'background.default' }}>
        <Box sx={{ width: '100%', maxWidth: 440 }}>
          <Paper elevation={3} sx={{ p: 5, textAlign: 'center' }}>
            <Box sx={{
              width: 72, height: 72, borderRadius: '50%',
              bgcolor: 'primary.main', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              mx: 'auto', mb: 3, fontSize: 32,
            }}>
              ✉️
            </Box>

            <Typography variant="h5" fontWeight={700} color="primary" gutterBottom>
              Check your inbox
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 1, lineHeight: 1.7 }}>
              We sent a verification link to
            </Typography>
            <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ mb: 3 }}>
              {email}
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 4, lineHeight: 1.7 }}>
              Click the link in the email to activate your account.
              The link expires in <strong>24 hours</strong>.
            </Typography>

            <Box sx={{ p: 2, bgcolor: '#dbeafe', borderRadius: 2, mb: 4 }}>
              <Typography variant="caption" color="primary" sx={{ lineHeight: 1.6 }}>
                Didn&apos;t receive it? Check your spam folder or{' '}
                <Box
                  component="span"
                  onClick={() => { setSubmitted(false); setLoading(false); }}
                  sx={{ fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  try again
                </Box>
                .
              </Typography>
            </Box>

            <Typography variant="body2" color="text.secondary">
              Already verified?{' '}
              <Link href="/sign-in" style={{ color: '#2563eb', fontWeight: 600 }}>
                Sign In
              </Link>
            </Typography>
          </Paper>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2, bgcolor: 'background.default' }}>
      <Box sx={{ width: '100%', maxWidth: 440 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="h4" fontWeight={700} color="primary">
            Create Account
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Sign up to get started
          </Typography>
        </Box>

        <Paper elevation={3} sx={{ p: 4 }}>
          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Input
                id="firstName"
                label="First Name"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
              />
              <Input
                id="lastName"
                label="Last Name"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
              />
            </Box>

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
              placeholder="Min. 6 characters"
              slotProps={{ htmlInput: { minLength: 6 } }}
            />

            <Button type="submit" variant="contained" size="large" loading={loading} fullWidth>
              Create Account
            </Button>
          </Box>

          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Already have an account?{' '}
              <Link href="/sign-in" style={{ color: '#2563eb', fontWeight: 600 }}>
                Sign In
              </Link>
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
