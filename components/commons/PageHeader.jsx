/**
 * PageHeader — Shared Authenticated Page Header
 *
 * Used at the top of every authenticated page module via <PageHeader title="..." />.
 * Renders: [SidebarTrigger] | [divider] | [page title (+ optional subtitle)] | [NotificationBell]
 *
 * Do NOT add a custom <header> in page modules — always use this component.
 * This is the shadcn SidebarInset header bar, so Tailwind utilities are allowed here
 * (the one documented exception to the MUI-only rule for system pages).
 */
'use client'

import { SidebarTrigger } from '@/components/ui/sidebar'
import NotificationBell from '@/app/modules/notifications/NotificationBell'

export default function PageHeader({ title, subtitle }) {
  return (
    <header className='sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/85 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-white/70'>
      <SidebarTrigger className='text-slate-500 hover:text-slate-900' />
      <div className='h-5 w-px bg-slate-200' />
      <div className='flex min-w-0 flex-1 flex-col justify-center'>
        <span className='truncate text-[15px] font-semibold leading-tight tracking-tight text-slate-800'>{title}</span>
        {subtitle && (
          <span className='truncate text-[11px] leading-tight text-slate-400'>{subtitle}</span>
        )}
      </div>
      <NotificationBell />
    </header>
  )
}
