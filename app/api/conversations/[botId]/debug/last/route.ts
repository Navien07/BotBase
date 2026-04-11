import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DbStepEntry {
  step: number
  name: string
  status: string
  duration_ms: number
  data: Record<string, unknown>
  blocked_response?: string
}

interface DbPipelineDebug {
  steps?: DbStepEntry[]
  intent?: string | null
  language?: string | null
  rag_found?: boolean
  total_ms?: number
}

interface NormalizedStep {
  step: number
  name: string
  status: 'pass' | 'block' | 'skip' | 'error'
  durationMs: number
  data: Record<string, unknown>
  blockedResponse?: string
}

// ─── GET /api/conversations/[botId]/debug/last?session_id=X ──────────────────

export async function GET(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  if (!botId) {
    return Response.json({ error: 'Missing botId' }, { status: 400 })
  }

  // Session auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('session_id')

  if (!sessionId) {
    return Response.json({ error: 'Missing session_id' }, { status: 400 })
  }

  try {
    const service = createServiceClient()

    // Find the testing conversation for this session
    const { data: conversation } = await service
      .from('conversations')
      .select('id')
      .eq('bot_id', botId)
      .eq('external_user_id', sessionId)
      .eq('channel', 'testing')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!conversation) {
      return Response.json({ error: 'No testing conversation found' }, { status: 404 })
    }

    // Get the latest assistant message with debug data
    const { data: message } = await service
      .from('messages')
      .select('pipeline_debug, source_chunks, intent, language, rag_found, response_latency_ms')
      .eq('conversation_id', conversation.id)
      .eq('bot_id', botId)
      .eq('role', 'assistant')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!message) {
      return Response.json({ error: 'No message found' }, { status: 404 })
    }

    const debug = message.pipeline_debug as DbPipelineDebug | null

    // Normalize steps from snake_case DB format to camelCase component format
    const steps: NormalizedStep[] = (debug?.steps ?? []).map((s) => ({
      step: s.step,
      name: s.name,
      status: (s.status as NormalizedStep['status']) ?? 'pass',
      durationMs: s.duration_ms ?? 0,
      data: s.data ?? {},
      ...(s.blocked_response ? { blockedResponse: s.blocked_response } : {}),
    }))

    // Fetch actual chunk content for the RAG context viewer
    const sourceChunkIds = (message.source_chunks as string[] | null) ?? []
    let ragChunks: Array<{ id: string; content: string; similarity?: number }> = []

    if (sourceChunkIds.length > 0) {
      const { data: chunks } = await service
        .from('knowledge_chunks')
        .select('id, content')
        .in('id', sourceChunkIds)

      ragChunks = (chunks ?? []).map((c: { id: string; content: string }) => ({
        id: c.id,
        content: c.content,
      }))
    }

    return Response.json({
      steps,
      intent: message.intent ?? null,
      language: message.language ?? 'en',
      ragFound: message.rag_found ?? false,
      latencyMs: message.response_latency_ms ?? 0,
      totalDurationMs: debug?.total_ms ?? 0,
      ragChunks,
    })
  } catch (error) {
    console.error('[debug/last GET]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
