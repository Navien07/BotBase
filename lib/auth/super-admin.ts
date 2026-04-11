/**
 * Super-admin identity is determined by email, NOT by profiles.role.
 * The profiles.role column can be overwritten by auth hooks/triggers.
 * Email comes directly from the Supabase JWT — it is immutable and trusted.
 */
export function isSuperAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false
  const list = (process.env.SUPER_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
  return list.includes(email.toLowerCase())
}
