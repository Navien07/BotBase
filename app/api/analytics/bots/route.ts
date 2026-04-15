import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  const { data: profile } = await service
    .from('profiles')
    .select('role, tenant_id')
    .eq('id', user.id)
    .single()

  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  const isSuperAdmin = profile.role === 'super_admin'

  let botsQuery = service.from('bots').select('id, name, tenant_id, tenants(name)').order('name')
  if (!isSuperAdmin) {
    botsQuery = botsQuery.eq('tenant_id', profile.tenant_id) as typeof botsQuery
  }

  const { data: bots } = await botsQuery

  return Response.json({
    isSuperAdmin,
    bots: (bots ?? []).map((b: Record<string, unknown>) => ({
      id: b.id,
      name: b.name,
      tenantName: isSuperAdmin ? (b.tenants as { name: string } | null)?.name : undefined,
    })),
  })
}
