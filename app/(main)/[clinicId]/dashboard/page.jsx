import { getSession } from '@/lib/auth';
import DashboardPage from '@/app/modules/dashboard-page/DashboardPage';

export const metadata = {
  title: 'Dashboard | Intellident',
};

export default async function Page() {
  const session = await getSession();
  return <DashboardPage session={session} />;
}
