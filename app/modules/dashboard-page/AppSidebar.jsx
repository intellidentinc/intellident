'use client';

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
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  FileText,
  CreditCard,
  Bell,
  ShieldCheck,
} from 'lucide-react';
import SignOutButton from './SignOutButton';

function getInitials(firstName, lastName) {
  const f = firstName?.[0] ?? '';
  const l = lastName?.[0] ?? '';
  return (f + l).toUpperCase() || '?';
}

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '#' },
  { label: 'Appointments', icon: CalendarDays, href: '#' },
  { label: 'Patients', icon: Users, href: '#' },
  { label: 'Records', icon: FileText, href: '#' },
  { label: 'Billing', icon: CreditCard, href: '#' },
  { label: 'Reminders', icon: Bell, href: '#' },
  { label: 'Audit Log', icon: ShieldCheck, href: '#' },
];

export default function AppSidebar({ session }) {
  return (
    <Sidebar>
      {/* Header */}
      <SidebarHeader className="border-b border-sidebar-border px-5 py-4">
        <span className="text-lg font-bold text-[#2563eb]">IntelliDent</span>
      </SidebarHeader>

      {/* Nav */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1 px-3">
              {navItems.map((item) => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton
                    size="lg"
                    render={<a href={item.href} />}
                    className="cursor-pointer pl-4"
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#2563eb] text-sm font-bold text-white">
            {getInitials(session?.firstName, session?.lastName)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground">
              {session?.firstName && session?.lastName
                ? `${session.firstName} ${session.lastName}`
                : session?.firstName ?? 'User'}
            </p>
            <p className="text-xs text-sidebar-foreground/60 truncate">
              {session?.email}
            </p>
          </div>
        </div>
        <SignOutButton />
      </SidebarFooter>
    </Sidebar>
  );
}
