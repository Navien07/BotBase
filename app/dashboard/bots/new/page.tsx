import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NewBotForm } from './new-bot-form'

export default async function NewBotPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return <NewBotForm role={profile?.role ?? 'tenant_admin'} />
}
