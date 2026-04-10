import { createServiceClient } from '@/lib/supabase/service'

interface RagLogParams {
  botId: string
  conversationId: string
  query: string
  chunksFound: number
  topSimilarity: number
  ragFound: boolean
}

export async function logRagQuery(params: RagLogParams): Promise<void> {
  const supabase = createServiceClient()
  const { botId, conversationId, query, chunksFound, topSimilarity, ragFound } = params

  // Store in audit_logs for now — dedicated rag_logs table added in later phase
  await supabase.from('audit_logs').insert({
    action: 'rag_query',
    bot_id: botId,
    user_id: '00000000-0000-0000-0000-000000000000', // system
    metadata: {
      conversation_id: conversationId,
      query: query.slice(0, 200),
      chunks_found: chunksFound,
      top_similarity: topSimilarity,
      rag_found: ragFound,
    },
  })
}
