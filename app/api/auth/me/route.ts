import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('role, tenant_id, full_name')
    .eq('id', user.id)
    .single()

  return Response.json({
    role: profile?.role,
    tenant_id: profile?.tenant_id,
    full_name: profile?.full_name,
    email: user.email,
  })
}
