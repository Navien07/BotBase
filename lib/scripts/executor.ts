import type { PipelineContext } from '@/lib/pipeline/types'
import type { BotScript } from '@/types/database'

export interface ScriptExecutionResult {
  response: string
  scriptId: string
}

// Stub — implemented in Phase 04 (Flow Builder)
export async function executeScript(
  _script: BotScript,
  _context: PipelineContext
): Promise<ScriptExecutionResult | null> {
  return null
}
