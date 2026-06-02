import { Suspense } from 'react';
import ChangePasswordPage from '@/app/modules/change-password-page/ChangePasswordPage';
export const metadata = { title: 'Change Password | IntelliDent' };
export default function Page() {
  return (
    <Suspense>
      <ChangePasswordPage />
    </Suspense>
  );
}
