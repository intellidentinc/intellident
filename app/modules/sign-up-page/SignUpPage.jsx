'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import { Eye, EyeOff } from 'lucide-react';
import Button from '@/components/commons/Button';
import Input from '@/components/commons/Input';
import Select from '@/components/commons/Select';
import { useToast } from '@/app/providers/ToastProvider';
import {
  generateSalt,
  generateMasterKey,
  deriveKEK,
  wrapMasterKey,
  toBase64,
} from '@/lib/crypto';

function getPasswordStrength(password) {
  if (!password) return { score: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const levels = [
    { label: 'Weak', color: '#E05C6A' },
    { label: 'Weak', color: '#E05C6A' },
    { label: 'Fair', color: '#f59e0b' },
    { label: 'Good', color: '#3b82f6' },
    { label: 'Strong', color: '#22c55e' },
  ];
  return { score, ...(levels[score - 1] ?? { label: 'Weak', color: '#E05C6A' }) };
}

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [clinicId, setClinicId] = useState('');
  const [clinicOptions, setClinicOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { showToast } = useToast();
  const passwordStrength = getPasswordStrength(password);

  useEffect(() => {
    fetch('/api/clinics')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setClinicOptions(data.map((c) => ({ value: c.id, label: c.name })));
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
    if (!passwordRegex.test(password)) {
      showToast('Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.', 'error');
      setLoading(false);
      return;
    }

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
        body: JSON.stringify({ email, password, firstName, lastName, wrappedKey, keySalt, clinicId: clinicId || null }),
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
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
              />
              <Input
                id="lastName"
                label="Last Name"
                type="text"
                required
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

            <Box>
              <Input
                id="password"
                label="Password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                slotProps={{ htmlInput: { minLength: 8 } }}
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
              {password && (
                <Box sx={{ mt: 1 }}>
                  <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Box
                        key={n}
                        sx={{
                          flex: 1,
                          height: 4,
                          borderRadius: 2,
                          bgcolor: n <= passwordStrength.score ? passwordStrength.color : '#e2e8f0',
                          transition: 'background-color 0.2s',
                        }}
                      />
                    ))}
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                    {[
                      { label: 'At least 8 characters', met: password.length >= 8 },
                      { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
                      { label: 'One lowercase letter', met: /[a-z]/.test(password) },
                      { label: 'One number', met: /[0-9]/.test(password) },
                      { label: 'One special character', met: /[^A-Za-z0-9]/.test(password) },
                    ].map(({ label, met }) => (
                      <Typography
                        key={label}
                        variant="caption"
                        sx={{ color: met ? '#22c55e' : '#94a3b8', display: 'flex', alignItems: 'center', gap: 0.5 }}
                      >
                        {met ? '✓' : '·'} {label}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              )}
            </Box>

            <Select
              id="clinicId"
              label="Clinic"
              value={clinicId}
              onChange={(e) => setClinicId(e.target.value)}
              options={clinicOptions}
              placeholder="Select your clinic"
              required
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

        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Link href="/" style={{ color: '#2563eb', fontWeight: 600, fontSize: 14 }}>
            ← Back to Home
          </Link>
        </Box>
      </Box>
    </Box>
  );
}
