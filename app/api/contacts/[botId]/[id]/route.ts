import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/service'

const ContactUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  language: z.string().optional(),
  tags: z.array(z.string()).optional(),
  lead_stage: z
    .enum(['new', 'engaged', 'qualified', 'booked', 'converted', 'churned'])
    .optional(),
  notes: z.string().max(5000).optional(),
  custom_fields: z.record(z.string(), z.unknown()).optional(),
  opt_out: z.boolean().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ botId: string; id: string }> }
) {
  const { botId, id } = await params
  if (!botId || !id) return Response.json({ error: 'Missing params' }, { status: 400 })

  try {
    const supabase = createServiceClient()

    const { data: contact, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .eq('bot_id', botId)
      .single()

    if (error || !contact) {
      return Response.json({ error: 'Contact not found' }, { status: 404 })
    }

    // Last 5 conversations
    const { data: conversations } = await supabase
      .from('conversations')
      .select('id, created_at, channel, language, metadata')
      .eq('contact_id', id)
      .eq('bot_id', botId)
      .order('created_at', { ascending: false })
      .limit(5)

    // Booking history
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id, booking_type, service_name, start_time, status, created_at')
      .eq('contact_id', id)
      .eq('bot_id', botId)
      .order('created_at', { ascending: false })

    return Response.json({ contact, conversations: conversations ?? [], bookings: bookings ?? [] })
  } catch (error) {
    console.error('[contacts/[id] GET]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ botId: string; id: string }> }
) {
  const { botId, id } = await params
  if (!botId || !id) return Response.json({ error: 'Missing params' }, { status: 400 })

  try {
    const body = await req.json()
    const parsed = ContactUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues }, { status: 400 })
    }

    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('contacts')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('bot_id', botId)
      .select()
      .single()

    if (error) throw error
    if (!data) return Response.json({ error: 'Contact not found' }, { status: 404 })

    return Response.json({ contact: data })
  } catch (error) {
    console.error('[contacts/[id] PUT]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ botId: string; id: string }> }
) {
  const { botId, id } = await params
  if (!botId || !id) return Response.json({ error: 'Missing params' }, { status: 400 })

  try {
    const supabase = createServiceClient()

    // Soft delete: mark opted out
    const { error } = await supabase
      .from('contacts')
      .update({ opt_out: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('bot_id', botId)

    if (error) throw error

    return Response.json({ success: true })
  } catch (error) {
    console.error('[contacts/[id] DELETE]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
