import { redirect } from 'next/navigation'

interface InviteValidation {
  valid: boolean
  email?: string
  error?: string
}

async function validateToken(token: string): Promise<InviteValidation> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/onboarding/invite/${token}`, {
    cache: 'no-store',
  })
  return res.json() as Promise<InviteValidation>
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const result = await validateToken(token)

  if (!result.valid || !result.email) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4"
           style={{ background: 'var(--bb-bg)' }}>
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
               style={{ background: 'rgba(239,68,68,0.1)' }}>
            <span className="text-2xl">✕</span>
          </div>
          <h1 className="text-lg font-semibold mb-2" style={{ color: 'var(--bb-text-1)' }}>
            Invalid Invite
          </h1>
          <p className="text-sm" style={{ color: 'var(--bb-text-2)' }}>
            {result.error ?? 'This invite link is expired or has already been used.'}
          </p>
        </div>
      </div>
    )
  }

  // Redirect to signup with email + token pre-filled
  redirect(`/signup?email=${encodeURIComponent(result.email)}&token=${token}`)
}
