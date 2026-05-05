'use client'

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
  SidebarMenuItem
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
  ClipboardList
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
            { label: 'Dashboard', icon: LayoutDashboard, href: p('/dashboard') },
            { label: 'My Schedules', icon: CalendarDays, href: p('/schedules') }
          ]
        },
        {
          label: 'Health',
          items: [{ label: 'My Dental Records', icon: FileText, href: p('/my-records') }]
        },
        {
          label: 'Account',
          items: [{ label: 'My Profile', icon: User, href: p('/profile') }]
        }
      ]

    case ROLES.DENTIST:
      return [
        {
          label: 'Navigation',
          items: [
            { label: 'Dashboard', icon: LayoutDashboard, href: p('/dashboard') },
            { label: 'Schedule', icon: CalendarDays, href: p('/schedule') }
          ]
        },
        {
          label: 'Clinical',
          items: [{ label: 'Patient Records', icon: FileText, href: p('/records') }]
        },
        {
          label: 'Account',
          items: [{ label: 'My Profile', icon: User, href: p('/profile') }]
        }
      ]

    case ROLES.RECEPTIONIST:
      return [
        {
          label: 'Navigation',
          items: [
            { label: 'Dashboard', icon: LayoutDashboard, href: p('/dashboard'), badgeKey: null },
            { label: 'Appointments', icon: CalendarDays, href: p('/appointments'), badgeKey: 'pending' },
            { label: 'Patients', icon: Users, href: p('/patients') }
          ]
        },
        {
          label: 'Billing',
          items: [{ label: 'Billing', icon: CreditCard, href: p('/billing') }]
        },
        {
          label: 'Account',
          items: [{ label: 'My Profile', icon: User, href: p('/profile') }]
        }
      ]

    case ROLES.ADMIN:
      return [
        {
          label: 'Navigation',
          items: [{ label: 'Dashboard', icon: LayoutDashboard, href: p('/dashboard') }]
        },
        {
          label: 'Management',
          items: [
            { label: 'Users', icon: UserCog, href: p('/users') },
            { label: 'Services', icon: Stethoscope, href: p('/services') },
            { label: 'Schedules', icon: CalendarDays, href: p('/appointments'), badgeKey: 'pending' },
            { label: 'Billing', icon: CreditCard, href: p('/billing') },
            { label: 'Settings', icon: Settings, href: p('/settings') }
          ]
        },
        {
          label: 'System',
          items: [{ label: 'Audit Log', icon: ShieldCheck, href: p('/audit-log') }]
        },
        {
          label: 'Account',
          items: [{ label: 'My Profile', icon: User, href: p('/profile') }]
        }
      ]

    default:
      return []
  }
}

export default function AppSidebar({ session, role = ROLES.PATIENT, clinicName, clinicLogo, pendingCount = 0, isSuperAdmin = false }) {
  const clinicId = session?.clinicId
  const navGroups = buildNavGroups(role, clinicId)
  const badges = { pending: pendingCount }

  return (
    <Sidebar>
      {/* Header */}
      <SidebarHeader className='border-b border-sidebar-border px-5 py-4'>
        {clinicLogo ? (
          <img src={clinicLogo} alt='Clinic logo' className='h-10 w-10 rounded-full object-cover mb-1' />
        ) : (
          <div className='h-10 w-10 rounded-full bg-[#dbeafe] flex items-center justify-center mb-1'>
            <Stethoscope size={20} className='text-[#2563eb]' />
          </div>
        )}
        <span className='text-lg font-bold text-[#2563eb]'>IntelliDent</span>
        {clinicName && <span className='text-xs text-sidebar-foreground/60'>{clinicName}</span>}
      </SidebarHeader>

      {/* Nav */}
      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className='gap-1 px-3'>
                {group.items.map((item) => {
                  const badgeCount = item.badgeKey ? (badges[item.badgeKey] ?? 0) : 0
                  return (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton size='lg' render={<a href={item.href} />} className='cursor-pointer pl-4'>
                        <item.icon />
                        <span className='flex-1'>{item.label}</span>
                        {badgeCount > 0 && (
                          <span className='ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[#2563eb] px-1.5 text-[10px] font-bold text-white'>
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
      <SidebarFooter className='border-t border-sidebar-border p-4'>
        {isSuperAdmin && (
          <div className='mb-3'>
            <ExitSuperAdminButton />
          </div>
        )}
        <div className='mb-3 flex items-center gap-3'>
          <div className='flex size-10 shrink-0 items-center justify-center rounded-full bg-[#2563eb] text-sm font-bold text-white'>
            {getInitials(session?.firstName, session?.lastName)}
          </div>
          <div className='min-w-0'>
            <p className='text-sm font-medium text-sidebar-foreground'>
              {session?.firstName && session?.lastName
                ? `${session.firstName} ${session.lastName}`
                : (session?.firstName ?? 'User')}
            </p>
            <p className='text-xs text-sidebar-foreground/60 truncate'>{session?.email}</p>
            <span className='mt-0.5 inline-block rounded-full bg-[#dbeafe] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#2563eb]'>
              {ROLE_LABELS[role] ?? role}
            </span>
          </div>
        </div>
        <SignOutButton />
      </SidebarFooter>
    </Sidebar>
  )
}
