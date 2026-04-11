import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import NewClientForm from './new-client-form'

export default async function NewClientPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const service = createServiceClient()
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  console.log('NewClientPage role check:', profile?.role, 'userId:', user.id)

  if (profile?.role !== 'super_admin') {
    redirect('/dashboard/overview')
  }

  return <NewClientForm />
}
