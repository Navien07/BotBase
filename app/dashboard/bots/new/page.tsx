import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import NewBotForm from './new-bot-form'

export default async function NewBotPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('role, tenant_id')
    .eq('id', user.id)
    .single()

  // super_admin creates bots via the client setup flow
  if (profile?.role === 'super_admin') redirect('/dashboard/clients/new')

  // tenant user must have a tenant
  if (!profile?.tenant_id) redirect('/dashboard/overview')

  return <NewBotForm />
}
