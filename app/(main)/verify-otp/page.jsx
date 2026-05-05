import { Suspense } from 'react'
import VerifyOtpPage from '@/app/modules/verify-otp-page/VerifyOtpPage'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Verify Sign-In | IntelliDent' }

export default function Page() {
  return (
    <Suspense>
      <VerifyOtpPage />
    </Suspense>
  )
}
