import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdminEmail } from '@/lib/auth/super-admin'
import NewClientForm from './new-client-form'

export default async function NewClientPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Use email as the source of truth — not profiles.role which can be overwritten
  if (!isSuperAdminEmail(user.email)) {
    redirect('/dashboard/overview')
  }

  return <NewClientForm />
}
