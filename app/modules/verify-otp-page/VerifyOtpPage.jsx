'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Button from '@/components/commons/Button';
import { useToast } from '@/app/providers/ToastProvider';
import { useCrypto } from '@/app/providers/CryptoProvider';
import { deriveKEK, unwrapMasterKey, fromBase64 } from '@/lib/crypto';
import { ShieldCheck } from 'lucide-react';

const OTP_LENGTH = 6;

export default function VerifyOtpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const { setMasterKey } = useCrypto();

  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [pendingToken, setPendingToken] = useState(null);
  const inputRefs = useRef([]);

  useEffect(() => {
    const token = searchParams.get('token');
    // Verify we have everything needed
    if (!token || !sessionStorage.getItem('mfa_pending')) {
      router.replace('/sign-in');
      return;
    }
    setPendingToken(token);
    // Auto-focus first input
    inputRefs.current[0]?.focus();
  }, []);

  function handleDigitChange(index, value) {
    // Accept only digits
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);

    // Advance focus
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = Array(OTP_LENGTH).fill('');
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    const focusIdx = Math.min(pasted.length, OTP_LENGTH - 1);
    inputRefs.current[focusIdx]?.focus();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const code = digits.join('');
    if (code.length < OTP_LENGTH) {
      showToast('Please enter the complete 6-digit code', 'warning');
      return;
    }

    setLoading(true);
    try {
      const stored = JSON.parse(sessionStorage.getItem('mfa_pending') || 'null');
      if (!stored) {
        showToast('Session expired. Please sign in again.', 'error');
        router.replace('/sign-in');
        return;
      }

      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingToken, code }),
      });

      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || 'Verification failed', 'error');
        // If the token is dead, send back to sign-in
        if (res.status === 400 || res.status === 429) {
          sessionStorage.removeItem('mfa_pending');
          setTimeout(() => router.replace('/sign-in'), 1500);
        } else {
          // Wrong code — clear digits and refocus
          setDigits(Array(OTP_LENGTH).fill(''));
          inputRefs.current[0]?.focus();
        }
        setLoading(false);
        return;
      }

      // Derive master key from stored credentials and unwrap
      const salt = fromBase64(stored.keySalt);
      const kek = await deriveKEK(stored.password, salt);
      const masterKey = await unwrapMasterKey(stored.wrappedKey, kek);
      setMasterKey(masterKey);

      sessionStorage.removeItem('mfa_pending');
      showToast('Signed in successfully!', 'success');
      router.push(data.clinicId ? `/${data.clinicId}/dashboard` : '/super');
    } catch {
      showToast('Something went wrong. Please try again.', 'error');
      setLoading(false);
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2, bgcolor: 'background.default' }}>
      <Box sx={{ width: '100%', maxWidth: 440 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <Box sx={{ width: 56, height: 56, borderRadius: 3, bgcolor: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={28} color='#2563eb' />
            </Box>
          </Box>
          <Typography variant='h4' fontWeight={700} color='primary'>
            Check your email
          </Typography>
          <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
            We sent a 6-digit code to your email address. Enter it below to sign in.
          </Typography>
        </Box>

        <Paper elevation={3} sx={{ p: 4 }}>
          <Box component='form' onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* OTP digit inputs */}
            <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center' }} onPaste={handlePaste}>
              {digits.map((digit, i) => (
                <TextField
                  key={i}
                  inputRef={(el) => (inputRefs.current[i] = el)}
                  value={digit}
                  onChange={(e) => handleDigitChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  inputProps={{ maxLength: 1, style: { textAlign: 'center', fontSize: 24, fontWeight: 700, padding: '12px 0' } }}
                  sx={{
                    width: 52,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      '&.Mui-focused fieldset': { borderColor: '#2563eb', borderWidth: 2 },
                    },
                  }}
                />
              ))}
            </Box>

            <Typography variant='caption' color='text.secondary' textAlign='center'>
              Code expires in 10 minutes. Check your spam folder if you don&apos;t see it.
            </Typography>

            <Button type='submit' variant='contained' size='large' loading={loading} fullWidth>
              Verify & Sign In
            </Button>
          </Box>
        </Paper>

        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Link href='/sign-in' style={{ color: '#2563eb', fontWeight: 600, fontSize: 14 }}>
            ← Back to Sign In
          </Link>
        </Box>
      </Box>
    </Box>
  );
}
