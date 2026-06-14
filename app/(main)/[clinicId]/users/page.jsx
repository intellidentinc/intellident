import RbacPage from '@/app/modules/rbac-page/RbacPage';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const metadata = { title: 'User Management | IntelliDent' };

// Server-render the first page (default sort) so the table paints with data on
// first load instead of mounting empty and firing a client-side fetch.
export default async function Page({ params }) {
  const { clinicId: routeClinicId } = await params;
  const session = await getSession();
  const clinicId = session?.clinicId ?? routeClinicId;

  const where = { clinicId, isDeleted: false };
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true, username: true, createdAt: true },
      orderBy: { firstName: 'asc' },
      skip: 0,
      take: 10,
    }),
    prisma.user.count({ where }),
  ]);

  return (
    <RbacPage
      isSuperAdmin={session?.superAdmin === true}
      initialRows={JSON.parse(JSON.stringify(users))}
      initialTotal={total}
    />
  );
}
