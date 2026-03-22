'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Button from '@/components/commons/Button';
import { useToast } from '@/app/providers/ToastProvider';
import { useCrypto } from '@/app/providers/CryptoProvider';

export default function SignOutButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();
  const { clearKey } = useCrypto();

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await fetch('/api/auth/sign-out', { method: 'POST' });
      clearKey();
      showToast('Signed out successfully.', 'success');
      router.push('/sign-in');
      router.refresh();
    } catch (error) {
      console.error('Sign out error:', error);
      showToast('Failed to sign out. Please try again.', 'error');
      setLoading(false);
    }
  };

  return (
    <Button variant="outlined" loading={loading} onClick={handleSignOut}>
      Sign Out
    </Button>
  );
}
