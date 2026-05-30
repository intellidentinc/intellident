'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import { Eye, EyeOff } from 'lucide-react';
import Button from '@/components/commons/Button';
import Input from '@/components/commons/Input';
import Select from '@/components/commons/Select';
import AddressSelector, { EMPTY_ADDRESS } from '@/components/commons/AddressSelector';
import { useToast } from '@/app/providers/ToastProvider';
import {
  generateSalt,
  generateMasterKey,
  deriveKEK,
  wrapMasterKey,
  toBase64,
} from '@/lib/crypto';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import ClinicApplicationForm from './ClinicApplicationForm';
import TermsDialog from './TermsDialog';

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

function SectionLabel({ children }) {
  return (
    <Typography
      variant="caption"
      fontWeight={700}
      sx={{ color: 'text.secondary', letterSpacing: '0.08em', textTransform: 'uppercase' }}
    >
      {children}
    </Typography>
  );
}

export default function SignUpPage() {
  const [mode, setMode] = useState('join'); // 'join' | 'apply'
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+63');
  const [address, setAddress] = useState({ ...EMPTY_ADDRESS });
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleInitial, setMiddleInitial] = useState('');
  const [lastName, setLastName] = useState('');
  const [clinicId, setClinicId] = useState('');
  const [clinicError, setClinicError] = useState('');
  const [clinicOptions, setClinicOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsDialogOpen, setTermsDialogOpen] = useState(false);
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

    if (password !== confirmPassword) {
      showToast('Passwords do not match.', 'error');
      setLoading(false);
      return;
    }

    if (!clinicId) {
      setClinicError('Please select a clinic');
      setLoading(false);
      return;
    }

    if (!/^\+63\d{10}$/.test(phone)) {
      showToast('Mobile must be +63 followed by 10 digits (e.g. +639123456789)', 'error');
      setLoading(false);
      return;
    }

    if (!termsAccepted) {
      showToast('You must accept the Terms of Service and Data Privacy Policy to continue.', 'error');
      setLoading(false);
      return;
    }

    try {
      const salt = generateSalt();
      const masterKey = await generateMasterKey();
      const kek = await deriveKEK(password, salt);
      const wrappedKey = await wrapMasterKey(masterKey, kek);
      const keySalt = toBase64(salt);

      const response = await fetch('/api/auth/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, phone, address, dateOfBirth: dateOfBirth || undefined, password, firstName, middleInitial: middleInitial || undefined, lastName, wrappedKey, keySalt, clinicId }),
      });

      const data = await response.json();

      if (!response.ok) {
        showToast(data.error || 'Something went wrong', 'error');
        setLoading(false);
        return;
      }

      setSubmitted(true);
    } catch {
      showToast('Failed to sign up. Please try again.', 'error');
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2, bgcolor: 'background.default' }}>
        <Box sx={{ width: '100%', maxWidth: 480 }}>
          <Paper elevation={3} sx={{ p: 5, textAlign: 'center', borderRadius: 2 }}>
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
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2, py: 5, bgcolor: 'background.default' }}>
      <Box sx={{ width: '100%', maxWidth: 640 }}>

        <Paper elevation={3} sx={{ borderRadius: 2, overflow: 'hidden' }}>

          {/* Card header */}
          <Box sx={{ px: { xs: 3, sm: 5 }, pt: 5, pb: 4, borderBottom: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
            <Typography variant="h4" fontWeight={700} color="primary">
              {mode === 'join' ? 'Create Account' : 'Register Your Clinic'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {mode === 'join' ? 'Fill in your details to get started' : 'Submit your clinic for review'}
            </Typography>

            {/* Mode toggle */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Box sx={{ display: 'inline-flex', border: '1px solid', borderColor: 'divider', borderRadius: 999, overflow: 'hidden' }}>
                <Box
                  component="button"
                  type="button"
                  onClick={() => setMode('join')}
                  sx={{
                    px: 2.5, py: 1, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                    bgcolor: mode === 'join' ? 'primary.main' : 'transparent',
                    color: mode === 'join' ? '#fff' : 'text.secondary',
                    transition: 'all 0.15s',
                    '&:hover': { bgcolor: mode === 'join' ? 'primary.dark' : 'action.hover' },
                  }}
                >
                  Join a Clinic
                </Box>
                <Box
                  component="button"
                  type="button"
                  onClick={() => setMode('apply')}
                  sx={{
                    px: 2.5, py: 1, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                    bgcolor: mode === 'apply' ? 'primary.main' : 'transparent',
                    color: mode === 'apply' ? '#fff' : 'text.secondary',
                    transition: 'all 0.15s',
                    '&:hover': { bgcolor: mode === 'apply' ? 'primary.dark' : 'action.hover' },
                  }}
                >
                  Register a Clinic
                </Box>
              </Box>
            </Box>
          </Box>

          {/* Clinic application form */}
          {mode === 'apply' && (
            <Box sx={{ px: { xs: 3, sm: 5 }, pt: 4, pb: 5 }}>
              <ClinicApplicationForm />
              <Box sx={{ textAlign: 'center', mt: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  Already have an account?{' '}
                  <Link href="/sign-in" style={{ color: '#2563eb', fontWeight: 600 }}>
                    Sign In
                  </Link>
                </Typography>
              </Box>
            </Box>
          )}

          {/* User sign-up form */}
          {mode === 'join' && <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{ px: { xs: 3, sm: 5 }, pt: 4, pb: 5, display: 'flex', flexDirection: 'column', gap: 4 }}
          >

            {/* ── Section 1: Personal Information ── */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <SectionLabel>Personal Information</SectionLabel>

              {/* Name row — grid ensures even columns with fixed M.I. */}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr', gap: 2 }}>
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
                  id="middleInitial"
                  label="M.I."
                  type="text"
                  value={middleInitial}
                  onChange={(e) => setMiddleInitial(e.target.value.slice(0, 2).toUpperCase())}
                  placeholder="A."
                  slotProps={{ htmlInput: { maxLength: 2 } }}
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

              {/* Email + Phone side by side */}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
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
                  id="phone"
                  label="Mobile Number"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => {
                    let val = e.target.value;
                    if (!val.startsWith('+63')) val = '+63' + val.replace(/^\+63/, '');
                    if (val.length <= 13) setPhone(val);
                  }}
                  placeholder="+639123456789"
                  error={!!phone && phone !== '+63' && !/^\+63\d{10}$/.test(phone)}
                  helperText={phone && phone !== '+63' && !/^\+63\d{10}$/.test(phone) ? 'Must be +63 followed by 10 digits' : ''}
                />
              </Box>

              {/* Birthdate — half width so it doesn't stretch uncomfortably */}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Input
                  id="dateOfBirth"
                  label="Birthdate"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  slotProps={{ htmlInput: { max: new Date().toISOString().split('T')[0] } }}
                />
                <Select
                  id="clinicId"
                  label="Clinic"
                  value={clinicId}
                  onChange={(e) => { setClinicId(e.target.value); setClinicError(''); }}
                  options={clinicOptions}
                  placeholder="Select your clinic"
                  error={!!clinicError}
                  helperText={clinicError}
                  required
                />
              </Box>
            </Box>

            <Divider />

            {/* ── Section 2: Account Security ── */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <SectionLabel>Account Security</SectionLabel>

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
                  <Box sx={{ mt: 1.5 }}>
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
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px' }}>
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

              <Input
                id="confirmPassword"
                label="Confirm Password"
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                error={!!confirmPassword && confirmPassword !== password}
                helperText={confirmPassword && confirmPassword !== password ? 'Passwords do not match' : ''}
                slotProps={{ htmlInput: { minLength: 8 } }}
                endAdornment={
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      edge="end"
                      size="small"
                      tabIndex={-1}
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </IconButton>
                  </InputAdornment>
                }
              />
            </Box>

            <Divider />

            {/* ── Section 3: Address ── */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <SectionLabel>Address</SectionLabel>
              <AddressSelector value={address} onChange={setAddress} />
            </Box>

            {/* ── Terms & Data Privacy Consent ── */}
            <Box sx={{
              p: 2.5,
              border: '1px solid',
              borderColor: termsAccepted ? 'primary.main' : 'divider',
              borderRadius: 2,
              bgcolor: termsAccepted ? '#dbeafe' : 'background.paper',
              transition: 'all 0.15s',
            }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    size="small"
                    sx={{ color: 'text.secondary', '&.Mui-checked': { color: 'primary.main' }, mt: '-2px', alignSelf: 'flex-start' }}
                  />
                }
                label={
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                    I have read and agree to the{' '}
                    <Box
                      component="span"
                      onClick={(e) => { e.preventDefault(); setTermsDialogOpen(true); }}
                      sx={{ color: 'primary.main', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Terms of Service &amp; Data Privacy Policy
                    </Box>
                    , including the collection and processing of my personal and health information in
                    accordance with the{' '}
                    <strong>Philippine Data Privacy Act of 2012 (RA 10173)</strong>,{' '}
                    <strong>ISO/IEC 27001</strong> security standards, and the{' '}
                    <strong>NIST Cybersecurity Framework</strong>.
                  </Typography>
                }
                sx={{ alignItems: 'flex-start', mx: 0 }}
              />
            </Box>

            <TermsDialog open={termsDialogOpen} onClose={() => setTermsDialogOpen(false)} />

            <Button type="submit" variant="contained" size="large" loading={loading} fullWidth disabled={!termsAccepted}>
              Create Account
            </Button>

            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Already have an account?{' '}
                <Link href="/sign-in" style={{ color: '#2563eb', fontWeight: 600 }}>
                  Sign In
                </Link>
              </Typography>
            </Box>

          </Box>}
        </Paper>

        <Box sx={{ mt: 3, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Link href="/" style={{ color: '#2563eb', fontWeight: 600, fontSize: 14 }}>
            ← Back to Home
          </Link>
          <Typography variant="caption" color="text.secondary">
            Need help?{' '}
            <a href="mailto:intellident.inc@gmail.com" style={{ color: '#2563eb', fontWeight: 600 }}>
              Contact Support
            </a>
          </Typography>
        </Box>

      </Box>
    </Box>
  );
}
