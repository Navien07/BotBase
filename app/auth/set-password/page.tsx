'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Bot, Lock } from 'lucide-react'

export default function SetPasswordPage() {
  const supabase = createClient()

  const [email, setEmail] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        window.location.href = '/login'
      } else {
        setEmail(user.email ?? null)
      }
      setChecking(false)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      toast.error('Passwords do not match')
      return
    }

    setLoading(true)
    const { data: updateData, error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      toast.error(updateError.message)
      setLoading(false)
      return
    }

    // Ensure profile row exists (uses metadata set during invite)
    if (updateData.user) {
      await fetch('/api/auth/setup-profile', { method: 'POST' }).catch(() => {})
    }

    toast.success('Password set! Welcome to BotBase.')
    window.location.href = '/dashboard/overview'
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bb-bg)' }}>
        <p style={{ color: 'var(--bb-text-3)' }}>Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bb-bg)' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--bb-primary)' }}>
            <Bot className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-semibold" style={{ color: 'var(--bb-text-1)' }}>BotBase</span>
        </div>

        {/* Card */}
        <div className="rounded-xl p-6 border" style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}>
          <h1 className="text-lg font-semibold mb-1" style={{ color: 'var(--bb-text-1)' }}>
            Set Your Password
          </h1>
          <p className="text-sm mb-6" style={{ color: 'var(--bb-text-2)' }}>
            Choose a password for your BotBase account
          </p>

          {email && (
            <div
              className="mb-4 px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--bb-surface-2)', color: 'var(--bb-text-3)', border: '1px solid var(--bb-border)' }}
            >
              {email}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--bb-text-2)' }}>
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--bb-text-3)' }} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Min. 8 characters"
                  autoFocus
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm border outline-none"
                  style={{ background: 'var(--bb-surface-2)', borderColor: 'var(--bb-border)', color: 'var(--bb-text-1)' }}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--bb-text-2)' }}>
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--bb-text-3)' }} />
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  placeholder="Re-enter password"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm border outline-none"
                  style={{ background: 'var(--bb-surface-2)', borderColor: 'var(--bb-border)', color: 'var(--bb-text-1)' }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50 hover:opacity-90"
              style={{ background: 'var(--bb-primary)', color: '#fff' }}
            >
              {loading ? 'Setting password…' : 'Set Password & Continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
