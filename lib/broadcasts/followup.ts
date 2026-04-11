// lib/broadcasts/followup.ts — Follow-up queue + drip sequence processing

import { createServiceClient } from '@/lib/supabase/service'
import { sendMessage } from '@/lib/channels/dispatcher'

export async function enqueueFollowup(
  botId: string,
  ruleId: string,
  contactId: string,
  conversationId?: string
): Promise<void> {
  const supabase = createServiceClient()

  // Fetch rule to get delay
  const { data: rule, error } = await supabase
    .from('followup_rules')
    .select('trigger_hours, is_active')
    .eq('id', ruleId)
    .eq('bot_id', botId)
    .single()

  if (error || !rule || !rule.is_active) return

  const delayHours = rule.trigger_hours ?? 24
  const nextAttemptAt = new Date(
    Date.now() + delayHours * 60 * 60_000
  ).toISOString()

  await supabase.from('followup_queue').insert({
    bot_id: botId,
    rule_id: ruleId,
    contact_id: contactId,
    conversation_id: conversationId ?? null,
    next_attempt_at: nextAttemptAt,
    status: 'pending',
    attempt_count: 0,
  })
}

export async function processFollowupQueue(): Promise<{ processed: number }> {
  const supabase = createServiceClient()

  const now = new Date().toISOString()

  const { data: items, error } = await supabase
    .from('followup_queue')
    .select(`
      id,
      bot_id,
      rule_id,
      contact_id,
      attempt_count,
      followup_rules!inner(trigger_hours, max_attempts, message_template, is_active)
    `)
    .eq('status', 'pending')
    .lte('next_attempt_at', now)
    .limit(100)

  if (error) {
    console.error('[processFollowupQueue]', error)
    return { processed: 0 }
  }

  let processed = 0

  for (const item of items ?? []) {
    const rule = (item as unknown as { followup_rules: {
      trigger_hours: number
      max_attempts: number
      message_template: string
      is_active: boolean
    } }).followup_rules

    if (!rule?.is_active) {
      await supabase
        .from('followup_queue')
        .update({ status: 'cancelled' })
        .eq('id', item.id)
      continue
    }

    try {
      const success = await sendMessage(
        item.contact_id,
        rule.message_template,
        item.bot_id
      )

      const newAttemptCount = item.attempt_count + 1
      const maxAttempts = rule.max_attempts ?? 3

      if (!success || newAttemptCount >= maxAttempts) {
        await supabase
          .from('followup_queue')
          .update({
            status: success ? 'completed' : 'failed',
            attempt_count: newAttemptCount,
            last_attempt_at: new Date().toISOString(),
          })
          .eq('id', item.id)
      } else {
        const delayHours = rule.trigger_hours ?? 24
        const nextAttemptAt = new Date(
          Date.now() + delayHours * 60 * 60_000
        ).toISOString()

        await supabase
          .from('followup_queue')
          .update({
            attempt_count: newAttemptCount,
            last_attempt_at: new Date().toISOString(),
            next_attempt_at: nextAttemptAt,
          })
          .eq('id', item.id)
      }

      processed++
    } catch (e) {
      console.error('[processFollowupQueue] item', item.id, e)

      await supabase
        .from('followup_queue')
        .update({
          status: 'failed',
          attempt_count: item.attempt_count + 1,
          last_attempt_at: new Date().toISOString(),
        })
        .eq('id', item.id)
    }
  }

  return { processed }
}

interface DripStep {
  order: number
  delay_hours: number
  message_template: string
}

export async function processDripSequences(): Promise<{ processed: number }> {
  const supabase = createServiceClient()

  const now = new Date().toISOString()

  const { data: enrollments, error } = await supabase
    .from('drip_enrollments')
    .select(`
      id,
      bot_id,
      contact_id,
      current_step,
      drip_sequences!inner(steps, is_active)
    `)
    .eq('status', 'active')
    .lte('next_step_at', now)
    .limit(100)

  if (error) {
    console.error('[processDripSequences]', error)
    return { processed: 0 }
  }

  let processed = 0

  for (const enrollment of enrollments ?? []) {
    const sequence = (enrollment as unknown as { drip_sequences: {
      steps: DripStep[]
      is_active: boolean
    } }).drip_sequences

    if (!sequence?.is_active) {
      await supabase
        .from('drip_enrollments')
        .update({ status: 'cancelled' })
        .eq('id', enrollment.id)
      continue
    }

    const steps = (sequence.steps ?? []) as DripStep[]
    const currentStep = enrollment.current_step ?? 0

    if (currentStep >= steps.length) {
      await supabase
        .from('drip_enrollments')
        .update({ status: 'completed' })
        .eq('id', enrollment.id)
      continue
    }

    const step = steps[currentStep]

    try {
      await sendMessage(enrollment.contact_id, step.message_template, enrollment.bot_id)

      const nextStep = currentStep + 1
      const isLastStep = nextStep >= steps.length

      if (isLastStep) {
        await supabase
          .from('drip_enrollments')
          .update({ status: 'completed', current_step: nextStep })
          .eq('id', enrollment.id)
      } else {
        const nextStepDef = steps[nextStep]
        const nextStepAt = new Date(
          Date.now() + (nextStepDef.delay_hours ?? 24) * 60 * 60_000
        ).toISOString()

        await supabase
          .from('drip_enrollments')
          .update({ current_step: nextStep, next_step_at: nextStepAt })
          .eq('id', enrollment.id)
      }

      processed++
    } catch (e) {
      console.error('[processDripSequences] enrollment', enrollment.id, e)
    }
  }

  return { processed }
}
