'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import { Eye, EyeOff } from 'lucide-react';
import Button from '@/components/commons/Button';
import Input from '@/components/commons/Input';
import { useToast } from '@/app/providers/ToastProvider';
import { generateSalt, generateMasterKey, deriveKEK, wrapMasterKey, toBase64 } from '@/lib/crypto';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

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

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { showToast } = useToast();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tokenValid, setTokenValid] = useState(null); // null=checking, true, false

  const passwordStrength = getPasswordStrength(newPassword);

  useEffect(() => {
    if (!token) { setTokenValid(false); return; }
    setTokenValid(true);
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!PASSWORD_REGEX.test(newPassword)) {
      showToast('Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match.', 'error');
      return;
    }

    setLoading(true);
    try {
      // Generate fresh key material with the new password
      const salt = generateSalt();
      const masterKey = await generateMasterKey();
      const kek = await deriveKEK(newPassword, salt);
      const wrappedKey = await wrapMasterKey(masterKey, kek);
      const keySalt = toBase64(salt);

      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword, wrappedKey, keySalt }),
      });
      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || 'Something went wrong', 'error');
        return;
      }

      showToast('Password reset successfully! Please sign in.', 'success');
      router.push('/sign-in');
    } catch {
      showToast('Failed to reset password. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (tokenValid === false) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2, bgcolor: 'background.default' }}>
        <Paper elevation={3} sx={{ p: 5, textAlign: 'center', maxWidth: 440, width: '100%' }}>
          <Typography variant="h5" fontWeight={700} color="error" gutterBottom>
            Invalid Reset Link
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            This password reset link is invalid or has expired. Please request a new one.
          </Typography>
          <Link href="/forgot-password" style={{ color: '#2563eb', fontWeight: 600 }}>
            Request new link
          </Link>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2, bgcolor: 'background.default' }}>
      <Box sx={{ width: '100%', maxWidth: 440 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="h4" fontWeight={700} color="primary">
            Reset Password
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Enter your new password below
          </Typography>
        </Box>

        <Paper elevation={3} sx={{ p: 4 }}>
          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box>
              <Input
                id="newPassword"
                label="New Password"
                type={showNew ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 8 characters"
                endAdornment={
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowNew((v) => !v)} edge="end" size="small" tabIndex={-1}>
                      {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                    </IconButton>
                  </InputAdornment>
                }
              />
              {newPassword && (
                <Box sx={{ mt: 1 }}>
                  <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Box key={n} sx={{ flex: 1, height: 4, borderRadius: 2, bgcolor: n <= passwordStrength.score ? passwordStrength.color : '#e2e8f0', transition: 'background-color 0.2s' }} />
                    ))}
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                    {[
                      { label: 'At least 8 characters',  met: newPassword.length >= 8 },
                      { label: 'One uppercase letter',   met: /[A-Z]/.test(newPassword) },
                      { label: 'One lowercase letter',   met: /[a-z]/.test(newPassword) },
                      { label: 'One number',             met: /[0-9]/.test(newPassword) },
                      { label: 'One special character',  met: /[^A-Za-z0-9]/.test(newPassword) },
                    ].map(({ label, met }) => (
                      <Typography key={label} variant="caption" sx={{ color: met ? '#22c55e' : '#94a3b8', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {met ? '✓' : '·'} {label}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              )}
            </Box>

            <Input
              id="confirmPassword"
              label="Confirm Password"
              type={showConfirm ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              endAdornment={
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowConfirm((v) => !v)} edge="end" size="small" tabIndex={-1}>
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </IconButton>
                </InputAdornment>
              }
            />

            <Button type="submit" variant="contained" size="large" loading={loading} fullWidth>
              Reset Password
            </Button>
          </Box>

          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Link href="/sign-in" style={{ color: '#2563eb', fontWeight: 600, fontSize: 14 }}>
              Back to Sign In
            </Link>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
