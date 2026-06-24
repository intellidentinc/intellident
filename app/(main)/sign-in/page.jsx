import SignInPage from '@/app/modules/sign-in-page/SignInPage';

export const metadata = {
  title: 'Sign In | Intellident',
};

// No Suspense wrapper: the app is force-dynamic (see app/layout.jsx), so useSearchParams in
// SignInPage no longer needs a Suspense boundary at build time. Keeping the boundary let Next
// prerender a static shell whose scripts lacked the per-request CSP nonce.
export default function Page() {
  return <SignInPage />;
}
