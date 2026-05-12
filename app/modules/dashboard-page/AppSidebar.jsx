'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ROLES, ROLE_LABELS } from '@/lib/roles'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  FileText,
  CreditCard,
  ShieldCheck,
  UserCog,
  Settings,
  Stethoscope,
  User,
} from 'lucide-react'
import SignOutButton from './SignOutButton'
import ExitSuperAdminButton from './ExitSuperAdminButton'

function getInitials(firstName, lastName) {
  const f = firstName?.[0] ?? ''
  const l = lastName?.[0] ?? ''
  return (f + l).toUpperCase() || '?'
}

function buildNavGroups(role, clinicId) {
  const p = (path) => `/${clinicId}${path}`

  switch (role) {
    case ROLES.PATIENT:
      return [
        {
          label: 'Navigation',
          items: [
            { label: 'Dashboard',        icon: LayoutDashboard, href: p('/dashboard') },
            { label: 'My Schedules',     icon: CalendarDays,    href: p('/schedules') },
          ],
        },
        {
          label: 'Health',
          items: [
            { label: 'My Dental Records', icon: FileText,    href: p('/my-records') },
            { label: 'My Bills',          icon: CreditCard,  href: p('/my-billing') },
          ],
        },
        {
          label: 'Account',
          items: [
            { label: 'My Profile', icon: User, href: p('/profile') },
          ],
        },
      ]

    case ROLES.DENTIST:
      return [
        {
          label: 'Navigation',
          items: [
            { label: 'Dashboard', icon: LayoutDashboard, href: p('/dashboard') },
            { label: 'Schedule',  icon: CalendarDays,    href: p('/schedule') },
          ],
        },
        {
          label: 'Clinical',
          items: [
            { label: 'Patient Records', icon: FileText, href: p('/records') },
          ],
        },
        {
          label: 'Account',
          items: [
            { label: 'My Profile', icon: User, href: p('/profile') },
          ],
        },
      ]

    case ROLES.RECEPTIONIST:
      return [
        {
          label: 'Navigation',
          items: [
            { label: 'Dashboard',    icon: LayoutDashboard, href: p('/dashboard') },
            { label: 'Appointments', icon: CalendarDays,    href: p('/appointments'), badgeKey: 'pending' },
            { label: 'Patients',     icon: Users,           href: p('/patients') },
          ],
        },
        {
          label: 'Billing',
          items: [
            { label: 'Billing', icon: CreditCard, href: p('/billing') },
          ],
        },
        {
          label: 'Account',
          items: [
            { label: 'My Profile', icon: User, href: p('/profile') },
          ],
        },
      ]

    case ROLES.ADMIN:
      return [
        {
          label: 'Navigation',
          items: [
            { label: 'Dashboard', icon: LayoutDashboard, href: p('/dashboard') },
          ],
        },
        {
          label: 'Management',
          items: [
            { label: 'Users',        icon: UserCog,      href: p('/users') },
            { label: 'Services',     icon: Stethoscope,  href: p('/services') },
            { label: 'Appointments', icon: CalendarDays, href: p('/appointments'), badgeKey: 'pending' },
            { label: 'Billing',      icon: CreditCard,   href: p('/billing') },
            { label: 'Settings',     icon: Settings,     href: p('/settings') },
          ],
        },
        {
          label: 'System',
          items: [
            { label: 'Audit Log', icon: ShieldCheck, href: p('/audit-log') },
          ],
        },
        {
          label: 'Account',
          items: [
            { label: 'My Profile', icon: User, href: p('/profile') },
          ],
        },
      ]

    default:
      return []
  }
}

export default function AppSidebar({ session, role = ROLES.PATIENT, clinicName, clinicLogo, pendingCount = 0, isSuperAdmin = false }) {
  const clinicId = session?.clinicId
  const navGroups = buildNavGroups(role, clinicId)
  const badges = { pending: pendingCount }
  const pathname = usePathname()

  return (
    <Sidebar>
      {/* Header */}
      <SidebarHeader className='border-b border-sidebar-border px-4 py-4'>
        <div className='flex items-center gap-2.5'>
          {clinicLogo ? (
            <img src={clinicLogo} alt='Clinic logo' className='h-8 w-8 rounded-lg object-cover flex-shrink-0' />
          ) : (
            <div className='h-8 w-8 rounded-lg bg-[#eff6ff] flex items-center justify-center flex-shrink-0'>
              <Stethoscope size={16} className='text-[#2563eb]' />
            </div>
          )}
          <div className='min-w-0'>
            <span className='block text-[14px] font-bold text-[#2563eb] leading-tight tracking-tight'>IntelliDent</span>
            {clinicName && (
              <span className='block text-[11px] text-sidebar-foreground/50 truncate leading-tight mt-0.5'>{clinicName}</span>
            )}
          </div>
        </div>
      </SidebarHeader>

      {/* Nav */}
      <SidebarContent className='py-3'>
        {navGroups.map((group) => (
          <SidebarGroup key={group.label} className='px-3 mb-1'>
            <SidebarGroupLabel className='text-[10px] font-semibold tracking-[0.1em] uppercase text-sidebar-foreground/35 px-2 mb-0.5'>
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className='gap-px'>
                {group.items.map((item) => {
                  const badgeCount = item.badgeKey ? (badges[item.badgeKey] ?? 0) : 0
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                  return (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton
                        size='default'
                        isActive={isActive}
                        render={<Link href={item.href} />}
                        className='cursor-pointer h-8 rounded-md px-2 text-[13px] font-medium transition-colors duration-100'
                      >
                        <item.icon size={15} className={isActive ? 'text-[#2563eb]' : 'text-sidebar-foreground/45'} />
                        <span className='flex-1'>{item.label}</span>
                        {badgeCount > 0 && (
                          <span className='ml-auto flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#2563eb] px-1 text-[9px] font-bold text-white tabular-nums'>
                            {badgeCount > 99 ? '99+' : badgeCount}
                          </span>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className='border-t border-sidebar-border p-3'>
        {isSuperAdmin && (
          <div className='mb-2'>
            <ExitSuperAdminButton />
          </div>
        )}

        {/* User info */}
        <div className='flex items-center gap-2.5 px-2 py-2 mb-2'>
          <div className='flex size-8 shrink-0 items-center justify-center rounded-full bg-[#2563eb] text-[11px] font-bold text-white'>
            {getInitials(session?.firstName, session?.lastName)}
          </div>
          <div className='min-w-0 flex-1'>
            <p className='text-[12.5px] font-semibold text-sidebar-foreground leading-tight truncate'>
              {session?.firstName && session?.lastName
                ? `${session.firstName} ${session.lastName}`
                : (session?.firstName ?? 'User')}
            </p>
            <p className='text-[10.5px] text-sidebar-foreground/45 truncate mt-px'>
              {ROLE_LABELS[role] ?? role} · {session?.email}
            </p>
          </div>
        </div>

        <SignOutButton />
      </SidebarFooter>
    </Sidebar>
  )
}
