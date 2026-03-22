import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from '@/app/modules/dashboard-page/AppSidebar';

export default async function ClinicLayout({ children, params }) {
  const session = await getSession();

  if (!session) {
    redirect('/sign-in');
  }

  const { clinicId } = await params;

  if (session.clinicId !== clinicId) {
    redirect('/sign-in');
  }

  const [user, clinic] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.userId }, select: { role: true } }),
    prisma.clinic.findUnique({ where: { id: clinicId }, select: { name: true } }),
  ]);

  return (
    <SidebarProvider>
      <AppSidebar session={session} role={user?.role ?? 'PATIENT'} clinicName={clinic?.name} />
      {children}
    </SidebarProvider>
  );
}
