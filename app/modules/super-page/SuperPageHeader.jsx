'use client'

import { SidebarTrigger } from '@/components/ui/sidebar'

export default function SuperPageHeader({ title }) {
  return (
    <header className='flex h-14 items-center gap-3 border-b bg-white px-4'>
      <SidebarTrigger />
      <div className='h-5 w-px bg-gray-200' />
      <span className='flex-1 font-semibold text-slate-700'>{title}</span>
    </header>
  )
}
