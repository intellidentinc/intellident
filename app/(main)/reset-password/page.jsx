import { Suspense } from 'react';
import ResetPasswordPage from '@/app/modules/reset-password-page/ResetPasswordPage';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reset Password | IntelliDent' };

export default function Page() {
  return (
    <Suspense>
      <ResetPasswordPage />
    </Suspense>
  );
}
