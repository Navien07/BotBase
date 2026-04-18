'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Bot, Lock, AlertTriangle, Loader2 } from 'lucide-react'

export default function SetPasswordPage() {
  const supabase = createClient()

  const [email, setEmail] = useState<string>('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const hash = window.location.hash
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')

    // Handle hash fragment tokens (recovery/invite flow via generateLink)
    if (hash.includes('access_token')) {
      const hashParams = new URLSearchParams(hash.substring(1))
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')

      if (accessToken && refreshToken) {
        supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          .then(({ data, error: sessionError }) => {
            if (data?.user && !sessionError) {
              setEmail(data.user.email ?? '')
              setReady(true)
            } else {
              setError('Invalid or expired link. Please request a new one.')
            }
          })
      } else {
        setError('Invalid or expired link. Please request a new one.')
      }
    }
    // Handle PKCE code exchange
    else if (code) {
      supabase.auth.exchangeCodeForSession(code)
        .then(({ data, error: exchangeError }) => {
          if (data?.user && !exchangeError) {
            setEmail(data.user.email ?? '')
            setReady(true)
          } else {
            setError('Invalid or expired link. Please request a new one.')
          }
        })
    }
    // No tokens in URL — wait briefly for hydration timing, then check session
    else {
      const timer = setTimeout(() => {
        const currentHash = window.location.hash
        const currentCode = new URLSearchParams(window.location.search).get('code')
        if (!currentHash.includes('access_token') && !currentCode) {
          // Last resort: check if there's already an active session (e.g. user navigated here directly)
          supabase.auth.getUser().then(({ data }) => {
            if (data?.user) {
              setEmail(data.user.email ?? '')
              setReady(true)
            } else {
              setError('No valid token found. Please request a new password reset link.')
            }
          })
        }
      }, 500)
      return () => clearTimeout(timer)
    }
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

    toast.success('Password set! Welcome to IceBot.')
    window.location.href = '/dashboard/overview'
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bb-bg)' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--bb-primary)' }}>
            <Bot className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-semibold" style={{ color: 'var(--bb-text-1)' }}>IceBot</span>
        </div>

        {/* Card */}
        <div className="rounded-xl p-6 border" style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}>
          {/* Loading state — verifying token */}
          {!ready && !error && (
            <div className="flex flex-col items-center py-6 gap-3">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--bb-primary)' }} />
              <p className="text-sm" style={{ color: 'var(--bb-text-3)' }}>Verifying your link…</p>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="flex flex-col items-center py-4 gap-4 text-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
                <AlertTriangle className="w-6 h-6" style={{ color: 'var(--bb-danger)' }} />
              </div>
              <div>
                <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--bb-text-1)' }}>
                  This link is invalid or has expired
                </h2>
                <p className="text-sm" style={{ color: 'var(--bb-text-3)' }}>{error}</p>
              </div>
              <Link
                href="/login"
                className="w-full py-2.5 rounded-lg text-sm font-medium text-center transition-opacity hover:opacity-90"
                style={{ background: 'var(--bb-primary)', color: '#fff' }}
              >
                Request a new link
              </Link>
            </div>
          )}

          {/* Password form — only shown after session is confirmed */}
          {ready && (
            <>
              <h1 className="text-lg font-semibold mb-1" style={{ color: 'var(--bb-text-1)' }}>
                Set Your Password
              </h1>
              <p className="text-sm mb-6" style={{ color: 'var(--bb-text-2)' }}>
                Choose a password for your IceBot account
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}
