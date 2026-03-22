import { Suspense } from 'react';
import SignInPage from '@/app/modules/sign-in-page/SignInPage';

export const metadata = {
  title: 'Sign In | Intellident',
};

export default function Page() {
  return (
    <Suspense>
      <SignInPage />
    </Suspense>
  );
}
