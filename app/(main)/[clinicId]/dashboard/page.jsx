import DashboardPage from '@/app/modules/dashboard-page/DashboardPage';

export const metadata = {
  title: 'Dashboard | Intellident',
};

export default function Page({ params }) {
  return <DashboardPage params={params} />;
}
