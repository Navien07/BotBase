import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { Wifi, WifiOff } from 'lucide-react'
import { BotTabNav } from '@/components/layout/BotTabNav'
import type { Bot } from '@/types/database'

interface BotLayoutProps {
  children: React.ReactNode
  params: Promise<{ botId: string }>
}

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  web_widget: 'Widget',
  instagram: 'Instagram',
  facebook: 'Facebook',
}

export default async function BotLayout({ children, params }: BotLayoutProps) {
  const { botId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Use service client to bypass RLS — auth check above already guards access
  const service = createServiceClient()

  const { data: bot } = await service
    .from('bots')
    .select('*')
    .eq('id', botId)
    .single()

  if (!bot) notFound()

  const { data: channels } = await service
    .from('channel_configs')
    .select('channel, is_active')
    .eq('bot_id', botId)
    .eq('is_active', true)

  const activeChannels = (channels ?? []).map((c: { channel: string }) => c.channel)

  return (
    <div className="flex flex-col h-full max-w-7xl mx-auto">
      {/* Bot header */}
      <div
        className="rounded-xl border p-4 mb-4 flex items-center gap-4"
        style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}
      >
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-lg font-bold"
          style={{ background: 'var(--bb-primary-subtle)', color: 'var(--bb-primary)' }}
        >
          {(bot as Bot).bot_name?.charAt(0) ?? (bot as Bot).name.charAt(0)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-semibold text-base" style={{ color: 'var(--bb-text-1)' }}>
              {(bot as Bot).name}
            </h2>
            <span
              className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
              style={{
                background: (bot as Bot).is_active ? 'rgba(34,197,94,0.1)' : 'var(--bb-surface-3)',
                color: (bot as Bot).is_active ? 'var(--bb-success)' : 'var(--bb-text-3)',
              }}
            >
              {(bot as Bot).is_active
                ? <><Wifi size={10} /> Live</>
                : <><WifiOff size={10} /> Inactive</>
              }
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs" style={{ color: 'var(--bb-text-3)' }}>
              {(bot as Bot).slug}
            </span>
            {activeChannels.length > 0 && (
              <>
                <span style={{ color: 'var(--bb-text-3)' }}>·</span>
                <div className="flex items-center gap-1.5">
                  {activeChannels.map((ch) => (
                    <span
                      key={ch}
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{ background: 'var(--bb-surface-2)', color: 'var(--bb-text-2)' }}
                    >
                      {CHANNEL_LABELS[ch] ?? ch}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Horizontal tab nav — client component for active state */}
      <BotTabNav botId={botId} />

      {/* Page content */}
      <div className="flex-1 min-h-0">
        {children}
      </div>
    </div>
  )
}
