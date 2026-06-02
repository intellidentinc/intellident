'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import { Eye, EyeOff } from 'lucide-react';
import Button from '@/components/commons/Button';
import Input from '@/components/commons/Input';
import { useToast } from '@/app/providers/ToastProvider';
import { useCrypto } from '@/app/providers/CryptoProvider';
import { generateSalt, deriveKEK, wrapMasterKey, toBase64 } from '@/lib/crypto';

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

export default function ChangePasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason');
  const { showToast } = useToast();
  const { masterKey } = useCrypto();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const passwordStrength = getPasswordStrength(newPassword);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!masterKey) {
      showToast('Session expired. Please sign in again.', 'error');
      router.push('/sign-in');
      return;
    }

    if (!PASSWORD_REGEX.test(newPassword)) {
      showToast('New password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match.', 'error');
      return;
    }

    setLoading(true);
    try {
      // Re-wrap the existing master key with the new password
      const salt = generateSalt();
      const kek = await deriveKEK(newPassword, salt);
      const wrappedKey = await wrapMasterKey(masterKey, kek);
      const keySalt = toBase64(salt);

      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, wrappedKey, keySalt }),
      });
      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || 'Something went wrong', 'error');
        return;
      }

      showToast('Password changed successfully!', 'success');
      if (reason) {
        router.push('/sign-in?changed=true');
      } else {
        router.back();
      }
    } catch {
      showToast('Failed to change password. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2, bgcolor: 'background.default' }}>
      <Box sx={{ width: '100%', maxWidth: 480 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="h4" fontWeight={700} color="primary">
            Change Password
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Enter your current password and choose a new one
          </Typography>
        </Box>

        {reason === 'first-login' && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            You must set a new password before you can continue.
          </Alert>
        )}
        {reason === 'expired' && (
          <Alert severity="error" sx={{ mb: 3 }}>
            Your password has expired. Please set a new one to continue.
          </Alert>
        )}

        <Paper elevation={3} sx={{ p: 4 }}>
          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Input
              id="currentPassword"
              label="Current Password"
              type={showCurrent ? 'text' : 'password'}
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              endAdornment={
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowCurrent((v) => !v)} edge="end" size="small" tabIndex={-1}>
                    {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
                  </IconButton>
                </InputAdornment>
              }
            />

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
                  <Typography variant="caption" fontWeight={600} sx={{ color: '#94a3b8', mb: 0.25, display: 'block' }}>
                    At least:
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                    {[
                      { label: '8 characters',        met: newPassword.length >= 8 },
                      { label: '1 uppercase letter',  met: /[A-Z]/.test(newPassword) },
                      { label: '1 lowercase letter',  met: /[a-z]/.test(newPassword) },
                      { label: '1 number',            met: /[0-9]/.test(newPassword) },
                      { label: '1 special character', met: /[^A-Za-z0-9]/.test(newPassword) },
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
              label="Confirm New Password"
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
              Change Password
            </Button>

            <Button variant="outlined" size="large" fullWidth onClick={() => router.back()} disabled={loading}>
              Cancel
            </Button>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
