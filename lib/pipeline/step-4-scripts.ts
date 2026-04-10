import { createServiceClient } from '@/lib/supabase/service'
import { executeScript } from '@/lib/scripts/executor'
import type { PipelineContext, StepResult } from './types'
import type { BotScript } from '@/types/database'

export async function step4Scripts(ctx: PipelineContext): Promise<StepResult> {
  const supabase = createServiceClient()

  const { data: scripts, error } = await supabase
    .from('bot_scripts')
    .select('*')
    .eq('bot_id', ctx.botId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error || !scripts || scripts.length === 0) {
    return {
      step: 4, name: 'scripts',
      status: 'skip',
      durationMs: 0,
      data: { scripts_checked: 0 },
    }
  }

  const messageLower = ctx.message.toLowerCase()

  for (const script of scripts as BotScript[]) {
    let matched = false

    if (script.trigger_type === 'always') {
      matched = true
    } else if (script.trigger_type === 'intent' && script.trigger_value) {
      matched = ctx.detectedIntent === script.trigger_value
    } else if (script.trigger_type === 'keyword' && script.trigger_value) {
      matched = messageLower.includes(script.trigger_value.toLowerCase())
    }

    if (matched) {
      const result = await executeScript(script, ctx)
      if (result) {
        ctx.activeScriptId = script.id
        return {
          step: 4, name: 'scripts',
          status: 'block',
          durationMs: 0,
          data: { script_id: script.id, script_name: script.name, trigger_type: script.trigger_type },
          blockedResponse: result.response,
        }
      }
    }
  }

  return {
    step: 4, name: 'scripts',
    status: 'pass',
    durationMs: 0,
    data: { scripts_checked: scripts.length },
  }
}
