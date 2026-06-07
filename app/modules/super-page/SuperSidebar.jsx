'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
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
import { Building2, FileText, Shield, Stethoscope, LifeBuoy } from 'lucide-react'
import SignOutButton from '@/app/modules/dashboard-page/SignOutButton'

function getInitials(firstName, lastName) {
  const f = firstName?.[0] ?? ''
  const l = lastName?.[0] ?? ''
  return (f + l).toUpperCase() || '?'
}

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { label: 'Clinics',      icon: Building2, href: '/super' },
      { label: 'Applications', icon: FileText,   href: '/super/applications' },
    ],
  },
  {
    label: 'Governance',
    items: [
      { label: 'Global Policies', icon: Shield, href: '/super/policies' },
    ],
  },
]

export default function SuperSidebar({ session }) {
  const pathname = usePathname()

  return (
    <Sidebar>
      <SidebarHeader className='border-b border-sidebar-border px-4 py-4'>
        <div className='flex items-center gap-2.5'>
          <div className='h-8 w-8 rounded-lg bg-[#eff6ff] flex items-center justify-center flex-shrink-0'>
            <Stethoscope size={16} className='text-[#2563eb]' />
          </div>
          <div className='min-w-0'>
            <span className='block text-[14px] font-bold text-[#2563eb] leading-tight tracking-tight'>IntelliDent</span>
            <span className='block text-[11px] text-sidebar-foreground/50 truncate leading-tight mt-0.5'>Super Admin Portal</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className='py-3'>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label} className='px-3 mb-1'>
            <SidebarGroupLabel className='text-[10px] font-semibold tracking-[0.1em] uppercase text-sidebar-foreground/35 px-2 mb-0.5'>
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className='gap-px'>
                {group.items.map((item) => {
                  const isActive = item.href === '/super'
                    ? pathname === '/super'
                    : pathname.startsWith(item.href)
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
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className='border-t border-sidebar-border p-3'>
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
              Super Admin · {session?.email}
            </p>
          </div>
        </div>

        <div className='flex items-center gap-2 px-2 py-1.5 mb-1 rounded-md text-[11.5px] text-sidebar-foreground/55'>
          <LifeBuoy size={13} />
          <span>intellident.inc@gmail.com</span>
        </div>

        <SignOutButton />
      </SidebarFooter>
    </Sidebar>
  )
}
