/**
 * PageHeader — Shared Authenticated Page Header
 *
 * Used at the top of every authenticated page module via <PageHeader title="..." />.
 * Renders: [SidebarTrigger] | [divider] | [page title] | [NotificationBell]
 *
 * Do NOT add a custom <header> in page modules — always use this component.
 * Despite being a client component, Next.js App Router allows server components to import it.
 */
'use client'

import { SidebarTrigger } from '@/components/ui/sidebar'
import NotificationBell from '@/app/modules/notifications/NotificationBell'

export default function PageHeader({ title }) {
  return (
    <header className='flex h-14 items-center gap-3 border-b bg-white px-4'>
      <SidebarTrigger />
      <div className='h-5 w-px bg-gray-200' />
      <span className='flex-1 font-semibold text-slate-700'>{title}</span>
      <NotificationBell />
    </header>
  )
}
