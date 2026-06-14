import RbacPage from '@/app/modules/rbac-page/RbacPage';
import { getSession } from '@/lib/auth';

export const metadata = { title: 'User Management | IntelliDent' };

export default async function Page() {
  const session = await getSession();
  return <RbacPage isSuperAdmin={session?.superAdmin === true} />;
}
