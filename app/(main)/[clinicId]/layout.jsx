import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from '@/app/modules/dashboard-page/AppSidebar';
import AIChatButton from '@/app/modules/ai-chat/AIChatButton';
import { ROLES } from '@/lib/roles';

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
    prisma.clinic.findUnique({ where: { id: clinicId }, select: { name: true, logoUrl: true, isEnabled: true } }),
  ]);

  if (!clinic) {
    redirect('/sign-in');
  }

  if (!clinic.isEnabled && !session.superAdmin) {
    redirect('/sign-in');
  }

  // Super admin enters a clinic with full ADMIN privileges
  const effectiveRole = user?.role === ROLES.SUPERADMIN ? ROLES.ADMIN : (user?.role ?? ROLES.PATIENT)

  let pendingCount = 0
  if (user && [ROLES.RECEPTIONIST, ROLES.ADMIN, ROLES.SUPERADMIN].includes(user.role)) {
    pendingCount = await prisma.appointment.count({
      where: { clinicId, isDeleted: false, status: 'PENDING' },
    })
  }

  return (
    <SidebarProvider>
      <AppSidebar session={session} role={effectiveRole} clinicName={clinic?.name} clinicLogo={clinic?.logoUrl} pendingCount={pendingCount} isSuperAdmin={session.superAdmin === true} />
      {children}
      <AIChatButton role={effectiveRole} />
    </SidebarProvider>
  );
}
