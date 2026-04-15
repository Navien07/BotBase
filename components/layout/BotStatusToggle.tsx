'use client'

import { useState } from 'react'
import { Wifi, WifiOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  botId: string
  initialActive: boolean
}

export function BotStatusToggle({ botId, initialActive }: Props) {
  const [isActive, setIsActive] = useState(initialActive)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    try {
      const res = await fetch(`/api/bots/${botId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive }),
      })
      const data = await res.json() as { bot?: { is_active: boolean }; error?: string }
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to update status')
        return
      }
      setIsActive(!isActive)
      toast.success(!isActive ? 'Bot is now live' : 'Bot deactivated')
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      title={isActive ? 'Click to deactivate' : 'Click to activate'}
      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium transition-all disabled:opacity-60 hover:opacity-80"
      style={{
        background: isActive ? 'rgba(34,197,94,0.1)' : 'var(--bb-surface-3)',
        color: isActive ? 'var(--bb-success)' : 'var(--bb-text-3)',
      }}
    >
      {loading
        ? <Loader2 size={10} className="animate-spin" />
        : isActive
          ? <Wifi size={10} />
          : <WifiOff size={10} />
      }
      {isActive ? 'Live' : 'Inactive'}
    </button>
  )
}
