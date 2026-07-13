'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
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
  useSidebar,
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
  BarChart2,
  LifeBuoy,
  FileSearch,
  Send,
} from 'lucide-react'
import SignOutButton from './SignOutButton'
import ExitSuperAdminButton from './ExitSuperAdminButton'
import { useToast } from '@/app/providers/ToastProvider'

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
            { label: 'Approved Transfers', icon: Send, href: p('/record-transfers') },
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
            { label: 'Patients',     icon: Users,        href: p('/patients') },
            { label: 'Services',     icon: Stethoscope,  href: p('/services') },
            { label: 'Appointments', icon: CalendarDays, href: p('/appointments'), badgeKey: 'pending' },
            { label: 'Billing',      icon: CreditCard,   href: p('/billing') },
            { label: 'Settings',     icon: Settings,     href: p('/settings') },
          ],
        },
        {
          label: 'System',
          items: [
            { label: 'Reports',       icon: BarChart2,   href: p('/reports')        },
            { label: 'Audit Log',     icon: ShieldCheck, href: p('/audit-log')      },
            { label: 'Data Requests', icon: FileSearch,  href: p('/data-requests')  },
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
  const { state, setOpen, isMobile } = useSidebar()
  const { showToast } = useToast()
  const [patientClinics, setPatientClinics] = useState([])
  const [switchingClinic, setSwitchingClinic] = useState(false)

  useEffect(() => {
    if (role !== ROLES.PATIENT) return
    fetch('/api/patient/clinics')
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => setPatientClinics(data.enrollments ?? []))
      .catch(() => setPatientClinics([]))
  }, [role])

  async function switchPatientClinic(clinicId) {
    if (!clinicId || clinicId === session?.clinicId || switchingClinic) return
    setSwitchingClinic(true)
    try {
      const response = await fetch('/api/patient/clinics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Failed to switch clinic')
      window.location.assign(`/${clinicId}/dashboard`)
    } catch (error) {
      showToast(error.message || 'Failed to switch clinic', 'error')
      setSwitchingClinic(false)
    }
  }

  // Hover-to-expand: temporarily open the rail while the pointer is over it,
  // collapsing again on leave — unless the user pinned it open via the trigger.
  const hoverOpenedRef = useRef(false)
  const handleMouseEnter = () => {
    if (isMobile) return
    if (state === 'collapsed') {
      hoverOpenedRef.current = true
      setOpen(true)
    }
  }
  const handleMouseLeave = () => {
    if (isMobile) return
    if (hoverOpenedRef.current) {
      hoverOpenedRef.current = false
      setOpen(false)
    }
  }

  return (
    <Sidebar collapsible='icon' onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {/* Header */}
      <SidebarHeader className='h-14 justify-center border-b border-sidebar-border px-4 py-0 group-data-[collapsible=icon]:px-0'>
        <div className='flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center'>
          {clinicLogo ? (
            <Image src={clinicLogo} alt='Clinic logo' width={32} height={32} className='h-8 w-8 rounded-lg object-cover flex-shrink-0' />
          ) : (
            <div className='h-8 w-8 rounded-lg bg-[#eff6ff] flex items-center justify-center flex-shrink-0'>
              <Stethoscope size={16} className='text-[#2563eb]' />
            </div>
          )}
          <div className='min-w-0 group-data-[collapsible=icon]:hidden'>
            <span className='block text-[14px] font-bold text-[#2563eb] leading-tight tracking-tight'>IntelliDent</span>
            {clinicName && (
              <span className='block text-[11px] text-sidebar-foreground/50 truncate leading-tight mt-0.5'>{clinicName}</span>
            )}
          </div>
        </div>
      </SidebarHeader>

      {/* Nav */}
      <SidebarContent className='py-3'>
        {role === ROLES.PATIENT && patientClinics.length > 1 && (
          <div className='mx-3 mb-3 rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-2 group-data-[collapsible=icon]:mx-1.5 group-data-[collapsible=icon]:p-1.5'>
            <label htmlFor='patient-clinic-switcher' className='mb-1 block px-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/45 group-data-[collapsible=icon]:hidden'>
              Active clinic
            </label>
            <select
              id='patient-clinic-switcher'
              value={session?.clinicId ?? ''}
              disabled={switchingClinic}
              onChange={(event) => switchPatientClinic(event.target.value)}
              className='h-8 w-full rounded-md border border-sidebar-border bg-sidebar px-2 text-[11.5px] font-medium text-sidebar-foreground outline-none focus:border-[#2563eb] disabled:opacity-60 group-data-[collapsible=icon]:h-7 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:text-[0px]'
              title='Switch active clinic'
            >
              {patientClinics.map((enrollment) => (
                <option key={enrollment.clinic.id} value={enrollment.clinic.id}>
                  {enrollment.clinic.name} ({enrollment.patientCode})
                </option>
              ))}
            </select>
          </div>
        )}
        {navGroups.map((group) => (
          <SidebarGroup key={group.label} className='px-3 mb-1 group-data-[collapsible=icon]:px-1.5'>
            <SidebarGroupLabel className='text-[10px] font-semibold tracking-[0.1em] uppercase text-sidebar-foreground/35 px-2 mb-0.5'>
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className='gap-0.5'>
                {group.items.map((item) => {
                  const badgeCount = item.badgeKey ? (badges[item.badgeKey] ?? 0) : 0
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                  return (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton
                        size='default'
                        isActive={isActive}
                        tooltip={item.label}
                        render={<Link href={item.href} />}
                        className={[
                          'cursor-pointer h-9 rounded-lg px-2.5 text-[13px] font-medium transition-colors duration-100',
                          'group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:!size-9 group-data-[collapsible=icon]:justify-center',
                          isActive
                            ? 'bg-[#eff6ff] text-[#2563eb] data-active:bg-[#eff6ff] data-active:text-[#2563eb] hover:bg-[#eff6ff]'
                            : 'text-sidebar-foreground/80 hover:bg-sidebar-accent',
                        ].join(' ')}
                      >
                        <item.icon size={17} className={isActive ? 'text-[#2563eb]' : 'text-sidebar-foreground/45'} />
                        <span className='flex-1 group-data-[collapsible=icon]:hidden'>{item.label}</span>
                        {badgeCount > 0 && (
                          <>
                            <span className='ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#2563eb] px-1 text-[9px] font-bold text-white tabular-nums group-data-[collapsible=icon]:hidden'>
                              {badgeCount > 99 ? '99+' : badgeCount}
                            </span>
                            {/* Collapsed-state dot indicator */}
                            <span className='absolute right-1 top-1 hidden h-2 w-2 rounded-full bg-[#2563eb] ring-2 ring-sidebar group-data-[collapsible=icon]:block' />
                          </>
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
      <SidebarFooter className='border-t border-sidebar-border p-3 group-data-[collapsible=icon]:p-2'>
        {isSuperAdmin && (
          <div className='mb-2 group-data-[collapsible=icon]:hidden'>
            <ExitSuperAdminButton />
          </div>
        )}

        {/* User info */}
        <div className='flex items-center gap-2.5 px-2 py-2 mb-2 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:mb-0'>
          <div className='flex size-8 shrink-0 items-center justify-center rounded-full bg-[#2563eb] text-[11px] font-bold text-white'>
            {getInitials(session?.firstName, session?.lastName)}
          </div>
          <div className='min-w-0 flex-1 group-data-[collapsible=icon]:hidden'>
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

        <div className='flex items-center gap-2 px-2 py-1.5 mb-1 rounded-md text-[11.5px] text-sidebar-foreground/55 group-data-[collapsible=icon]:hidden'>
          <LifeBuoy size={13} />
          <span>intellident.inc@gmail.com</span>
        </div>

        <div className='group-data-[collapsible=icon]:hidden'>
          <SignOutButton />
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
