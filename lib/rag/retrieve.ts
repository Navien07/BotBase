import { createServiceClient } from '@/lib/supabase/service'
import type { RAGChunk, FAQResult } from '@/lib/pipeline/types'

export async function retrieveChunks(
  embedding: number[],
  botId: string,
  threshold: number,
  limit = 5
): Promise<RAGChunk[]> {
  const supabase = createServiceClient()

  const { data, error } = await supabase.rpc('match_chunks', {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: limit,
    filter_bot_id: botId,
  })

  if (error) {
    console.error('[rag/retrieve] match_chunks error:', error)
    return []
  }

  return (data ?? []).map((row: { id: string; content: string; similarity: number; document_id: string }) => ({
    id: row.id,
    content: row.content,
    similarity: row.similarity,
    documentId: row.document_id,
  }))
}

export async function retrieveFaqs(
  embedding: number[],
  botId: string,
  threshold: number,
  limit = 3
): Promise<FAQResult | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase.rpc('match_faqs', {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: limit,
    filter_bot_id: botId,
  })

  if (error) {
    console.error('[rag/retrieve] match_faqs error:', error)
    return null
  }

  if (!data || data.length === 0) return null

  const top = data[0] as { question: string; answer: string; similarity: number }
  return {
    question: top.question,
    answer: top.answer,
    similarity: top.similarity,
  }
}

export async function retrieveProducts(
  embedding: number[],
  botId: string,
  threshold: number,
  limit = 3
): Promise<RAGChunk[]> {
  const supabase = createServiceClient()

  // Use match_products RPC if available, otherwise fallback gracefully
  const { data, error } = await supabase.rpc('match_products', {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: limit,
    filter_bot_id: botId,
  })

  if (error) {
    // RPC may not exist yet — silently skip
    return []
  }

  return (data ?? []).map((row: { id: string; name: string; description: string; similarity: number }) => ({
    id: row.id,
    content: `${row.name}\n${row.description ?? ''}`.trim(),
    similarity: row.similarity,
    documentId: row.id,
  }))
}
