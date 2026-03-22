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
  UserCog,
} from 'lucide-react';
import SignOutButton from './SignOutButton';

function getInitials(firstName, lastName) {
  const f = firstName?.[0] ?? '';
  const l = lastName?.[0] ?? '';
  return (f + l).toUpperCase() || '?';
}

export default function AppSidebar({ session }) {
  const clinicId = session?.clinicId;

  const mainNavItems = [
    { label: 'Dashboard', icon: LayoutDashboard, href: `/${clinicId}/dashboard` },
    { label: 'Appointments', icon: CalendarDays, href: `/${clinicId}/appointments` },
    { label: 'Billing', icon: CreditCard, href: `/${clinicId}/billing` },
    { label: 'Reminders', icon: Bell, href: `/${clinicId}/reminders` },
  ];

  const staffNavItems = [
    { label: 'Patients', icon: Users, href: `/${clinicId}/patients` },
    { label: 'Records', icon: FileText, href: `/${clinicId}/records` },
  ];

  const resolvedAdminItems = [
    { label: 'User Management', icon: UserCog, href: `/${clinicId}/users` },
    { label: 'Audit Log', icon: ShieldCheck, href: `/${clinicId}/audit-log` },
  ];

  return (
    <Sidebar>
      {/* Header */}
      <SidebarHeader className="border-b border-sidebar-border px-5 py-4">
        <span className="text-lg font-bold text-[#2563eb]">IntelliDent</span>
      </SidebarHeader>

      {/* Nav */}
      <SidebarContent>
        {/* Main */}
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1 px-3">
              {mainNavItems.map((item) => (
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

        {/* Staff */}
        <SidebarGroup>
          <SidebarGroupLabel>Staff</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1 px-3">
              {staffNavItems.map((item) => (
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

        {/* Admin */}
        <SidebarGroup>
          <SidebarGroupLabel>Admin</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1 px-3">
              {resolvedAdminItems.map((item) => (
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
