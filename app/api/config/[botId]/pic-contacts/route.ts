// app/api/config/[botId]/pic-contacts/route.ts — Elken PIC WhatsApp numbers

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireBotAccess } from '@/lib/auth/require-bot-access'

const PicContactsSchema = z.object({
  okr:    z.union([z.literal(''), z.string().regex(/^\+[0-9]{10,15}$/, 'Must be international format e.g. +60122208396')]),
  subang: z.union([z.literal(''), z.string().regex(/^\+[0-9]{10,15}$/, 'Must be international format e.g. +60122206215')]),
})

// ─── GET: fetch current PIC numbers ───────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const accessCheck = await requireBotAccess(user.id, botId, { userEmail: user.email })
  if (accessCheck instanceof Response) return accessCheck

  try {
    const { data, error } = await createServiceClient()
      .from('bots')
      .select('pic_contacts')
      .eq('id', botId)
      .single()

    if (error) throw error
    if (!data) return Response.json({ error: 'Bot not found' }, { status: 404 })

    const contacts = (data.pic_contacts ?? {}) as Record<string, string>
    return Response.json({ okr: contacts.okr ?? '', subang: contacts.subang ?? '' })
  } catch (error) {
    console.error('[pic-contacts GET]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// ─── PATCH: update PIC numbers ────────────────────────────────────────────────

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const accessCheck = await requireBotAccess(user.id, botId, { userEmail: user.email })
  if (accessCheck instanceof Response) return accessCheck

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = PicContactsSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const { error } = await createServiceClient()
      .from('bots')
      .update({
        pic_contacts: {
          okr:    parsed.data.okr    || undefined,
          subang: parsed.data.subang || undefined,
        },
      })
      .eq('id', botId)

    if (error) throw error

    return Response.json({ success: true })
  } catch (error) {
    console.error('[pic-contacts PATCH]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
