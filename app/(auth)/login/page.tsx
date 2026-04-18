'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Bot, Mail, Lock, Globe } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [mode, setMode] = useState<'password' | 'magic'>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [magicSent, setMagicSent] = useState(false)

  // Handle invite and recovery magic links (hash-based tokens)
  useEffect(() => {
    const hash = window.location.hash
    if (!hash.includes('access_token')) return

    const params = new URLSearchParams(hash.substring(1))
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const type = params.get('type')

    if ((type === 'invite' || type === 'recovery') && accessToken && refreshToken) {
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ data, error }) => {
          if (data.user && !error) {
            window.location.href = '/auth/set-password'
          }
        })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      toast.error(error.message)
    } else {
      // Full page navigation ensures auth cookie is sent with the new request.
      // router.push() uses RSC fetch which can race against cookie-setting.
      window.location.href = '/dashboard/overview'
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    })
    setLoading(false)
    if (error) {
      toast.error(error.message)
    } else {
      setMagicSent(true)
    }
  }

  async function handleGoogleSSO() {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
    if (error) {
      setLoading(false)
      toast.error(error.message)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ background: 'var(--bb-bg)' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center"
               style={{ background: 'var(--bb-primary)' }}>
            <Bot className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-semibold" style={{ color: 'var(--bb-text-1)' }}>
            IceBot
          </span>
        </div>

        {/* Card */}
        <div className="rounded-xl p-6 border"
             style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}>
          <h1 className="text-lg font-semibold mb-1" style={{ color: 'var(--bb-text-1)' }}>
            Sign in
          </h1>
          <p className="text-sm mb-6" style={{ color: 'var(--bb-text-2)' }}>
            Access your IceBot dashboard
          </p>

          {magicSent ? (
            <div className="text-center py-4">
              <Mail className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--bb-primary)' }} />
              <p className="font-medium mb-1" style={{ color: 'var(--bb-text-1)' }}>Check your email</p>
              <p className="text-sm" style={{ color: 'var(--bb-text-2)' }}>
                We sent a sign-in link to <strong>{email}</strong>
              </p>
            </div>
          ) : (
            <>
              {/* Google SSO */}
              <button
                onClick={handleGoogleSSO}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium border mb-4 transition-colors hover:opacity-80 disabled:opacity-50"
                style={{ background: 'var(--bb-surface-2)', borderColor: 'var(--bb-border)', color: 'var(--bb-text-1)' }}
              >
                <Globe className="w-4 h-4" />
                Continue with Google
              </button>

              {/* Divider */}
              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t" style={{ borderColor: 'var(--bb-border)' }} />
                </div>
                <div className="relative flex justify-center text-xs" style={{ color: 'var(--bb-text-3)' }}>
                  <span className="px-2" style={{ background: 'var(--bb-surface)' }}>or</span>
                </div>
              </div>

              {/* Mode tabs */}
              <div className="flex gap-1 mb-4 p-1 rounded-lg" style={{ background: 'var(--bb-surface-2)' }}>
                {(['password', 'magic'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className="flex-1 py-1.5 text-xs rounded-md transition-colors font-medium"
                    style={{
                      background: mode === m ? 'var(--bb-surface-3)' : 'transparent',
                      color: mode === m ? 'var(--bb-text-1)' : 'var(--bb-text-2)',
                    }}
                  >
                    {m === 'password' ? 'Password' : 'Magic Link'}
                  </button>
                ))}
              </div>

              {/* Email + password */}
              <form onSubmit={mode === 'password' ? handlePasswordLogin : handleMagicLink}
                    className="space-y-3">
                <div>
                  <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--bb-text-2)' }}>
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                          style={{ color: 'var(--bb-text-3)' }} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="you@company.com"
                      className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm border outline-none focus:ring-1"
                      style={{
                        background: 'var(--bb-surface-2)',
                        borderColor: 'var(--bb-border)',
                        color: 'var(--bb-text-1)',
                      }}
                    />
                  </div>
                </div>

                {mode === 'password' && (
                  <div>
                    <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--bb-text-2)' }}>
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                            style={{ color: 'var(--bb-text-3)' }} />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                        className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm border outline-none"
                        style={{
                          background: 'var(--bb-surface-2)',
                          borderColor: 'var(--bb-border)',
                          color: 'var(--bb-text-1)',
                        }}
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50 hover:opacity-90"
                  style={{ background: 'var(--bb-primary)', color: '#fff' }}
                >
                  {loading
                    ? 'Signing in...'
                    : mode === 'password'
                    ? 'Sign in'
                    : 'Send Magic Link'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs mt-4" style={{ color: 'var(--bb-text-3)' }}>
          IceBot is invite-only. Contact your administrator.
        </p>
      </div>
    </div>
  )
}
