'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Bot, Lock, User } from 'lucide-react'

function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email') ?? ''
  const token = searchParams.get('token') ?? ''

  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    setLoading(true)

    const res = await fetch(`/api/onboarding/invite/${token}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, display_name: displayName }),
    })
    const data = await res.json() as { error?: string }
    setLoading(false)

    if (!res.ok) {
      toast.error(data.error ?? 'Signup failed')
      return
    }

    // Sign in with new credentials
    const { error } = await createClient().auth.signInWithPassword({ email, password })
    if (error) {
      toast.error(error.message)
      return
    }
    router.push('/onboarding/create-bot')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ background: 'var(--bb-bg)' }}>
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center"
               style={{ background: 'var(--bb-primary)' }}>
            <Bot className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-semibold" style={{ color: 'var(--bb-text-1)' }}>
            BotBase
          </span>
        </div>

        <div className="rounded-xl p-6 border"
             style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}>
          <h1 className="text-lg font-semibold mb-1" style={{ color: 'var(--bb-text-1)' }}>
            Create your account
          </h1>
          <p className="text-sm mb-6" style={{ color: 'var(--bb-text-2)' }}>
            You were invited to join BotBase
          </p>

          <form onSubmit={handleSignup} className="space-y-3">
            {/* Invited email — read only */}
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--bb-text-2)' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                readOnly
                className="w-full px-3 py-2.5 rounded-lg text-sm border"
                style={{
                  background: 'var(--bb-surface-3)',
                  borderColor: 'var(--bb-border)',
                  color: 'var(--bb-text-3)',
                }}
              />
            </div>

            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: 'var(--bb-text-2)' }}>
                Display Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                      style={{ color: 'var(--bb-text-3)' }} />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  placeholder="Your name"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm border outline-none"
                  style={{
                    background: 'var(--bb-surface-2)',
                    borderColor: 'var(--bb-border)',
                    color: 'var(--bb-text-1)',
                  }}
                />
              </div>
            </div>

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
                  minLength={8}
                  placeholder="Min 8 characters"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm border outline-none"
                  style={{
                    background: 'var(--bb-surface-2)',
                    borderColor: 'var(--bb-border)',
                    color: 'var(--bb-text-1)',
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50 hover:opacity-90"
              style={{ background: 'var(--bb-primary)', color: '#fff' }}
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  )
}
