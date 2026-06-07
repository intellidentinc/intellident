import { Suspense } from 'react';
import StepUpPage from '@/app/modules/step-up-page/StepUpPage';

export const metadata = { title: 'Verify Identity | IntelliDent' };

export default function Page() {
  return (
    <Suspense>
      <StepUpPage />
    </Suspense>
  );
}
