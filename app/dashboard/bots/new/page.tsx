import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import { NewBotForm } from './new-bot-form'

export default async function NewBotPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const serviceClient = createServiceClient()
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isSuperAdmin = profile?.role === 'super_admin'
  console.log('[NewBotPage] userId:', user.id, 'role:', profile?.role, 'isSuperAdmin:', isSuperAdmin)

  return <NewBotForm isSuperAdmin={isSuperAdmin} />
}
