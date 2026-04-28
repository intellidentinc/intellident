'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export default function ExitSuperAdminButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleExit() {
    setLoading(true)
    try {
      await fetch('/api/super/exit', { method: 'POST' })
      router.push('/super')
    } catch {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleExit}
      disabled={loading}
      className='flex w-full items-center gap-2 rounded-lg border border-[#2563eb] px-3 py-2 text-xs font-semibold text-[#2563eb] transition-colors hover:bg-[#dbeafe] disabled:opacity-60'
    >
      <ArrowLeft size={13} />
      {loading ? 'Exiting…' : 'Back to Super Admin'}
    </button>
  )
}
