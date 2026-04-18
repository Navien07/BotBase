import { createServiceClient } from '@/lib/supabase/service'

export type AuditAction =
  | 'api_key_created'
  | 'api_key_revoked'
  | 'bot_config_changed'
  | 'bot_created'
  | 'bot_deleted'
  | 'channel_connected'
  | 'channel_disconnected'
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'booking_manual_edit'
  | 'contact_deleted'
  | 'broadcast_sent'
  | 'agent_takeover_started'
  | 'agent_takeover_ended'
  | 'tenant_created'
  | 'tenant_suspended'
  | 'invite_created'
  | 'invite_accepted'
  | 'media_trigger_uploaded'
  | 'media_trigger_edited'
  | 'media_trigger_deleted'

export interface AuditLogParams {
  action: AuditAction
  botId?: string
  tenantId?: string
  userId: string
  metadata?: Record<string, unknown>
}

export async function logAudit(params: AuditLogParams): Promise<void> {
  try {
    const supabase = createServiceClient()
    await supabase.from('audit_logs').insert({
      action: params.action,
      bot_id: params.botId ?? null,
      tenant_id: params.tenantId ?? null,
      user_id: params.userId,
      metadata: params.metadata ?? {},
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    // Never throw — audit failures must not break the main flow
    console.error('[audit-logger]', error)
  }
}
