import { Suspense } from 'react'
import AcceptTermsPage from '@/app/modules/accept-terms-page/AcceptTermsPage'
export const metadata = { title: 'Terms of Service | IntelliDent' }
export default function Page() {
  return (
    <Suspense>
      <AcceptTermsPage />
    </Suspense>
  )
}
