import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { scrapeUrl } from '@/lib/ingest/url-scraper'
import { chunkText } from '@/lib/ingest/chunker'
import { embedTexts } from '@/lib/ingest/embedder'
import { isQnADocument, parseQnA } from '@/lib/ingest/qna-parser'

export const maxDuration = 60

const UrlSchema = z.object({
  url: z.string().url(),
})

// Batch embed texts in groups of 128 (VoyageAI API limit)
async function batchEmbed(texts: string[]): Promise<number[][]> {
  const BATCH_SIZE = 128
  const results: number[][] = []
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    const embeddings = await embedTexts(batch)
    results.push(...embeddings)
  }
  return results
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params

  if (!botId) {
    return Response.json({ error: 'Missing botId' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = UrlSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid URL', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { url } = parsed.data
  const service = createServiceClient()

  try {
    // Scrape URL
    const { title, text } = await scrapeUrl(url)

    if (!text.trim()) {
      return Response.json({ error: 'No content extracted from URL' }, { status: 400 })
    }

    // Create document record
    const { data: doc, error: insertError } = await service
      .from('documents')
      .insert({
        bot_id: botId,
        filename: title || url,
        file_path: url,
        file_size: null,
        mime_type: 'text/html',
        category: 'url',
        ingest_mode: 'chunks',
        status: 'processing',
        chunk_count: 0,
      })
      .select('id')
      .single()

    if (insertError || !doc) {
      console.error('[ingest/url POST] insert error', insertError)
      return Response.json({ error: 'Failed to create document record' }, { status: 500 })
    }

    const documentId = doc.id
    let chunkCount = 0

    try {
      if (isQnADocument(text)) {
        const pairs = parseQnA(text)

        if (pairs.length > 0) {
          const embeddings = await batchEmbed(pairs.map((p) => p.answer))

          const faqRows = pairs.map((pair, idx) => ({
            bot_id: botId,
            question: pair.question,
            answer: pair.answer,
            language: 'en' as const,
            embedding: embeddings[idx],
            is_active: true,
          }))

          for (let i = 0; i < faqRows.length; i += 50) {
            const { error } = await service
              .from('faqs')
              .insert(faqRows.slice(i, i + 50))
            if (error) throw new Error(`Failed to insert FAQs: ${error.message}`)
          }

          chunkCount = pairs.length
        }

        await service
          .from('documents')
          .update({ status: 'ready', chunk_count: chunkCount, ingest_mode: 'qna' })
          .eq('id', documentId)
          .eq('bot_id', botId)
      } else {
        const chunks = chunkText(text)

        if (chunks.length > 0) {
          const embeddings = await batchEmbed(chunks.map((c) => c.content))

          const chunkRows = chunks.map((chunk, idx) => ({
            bot_id: botId,
            document_id: documentId,
            content: chunk.content,
            embedding: embeddings[idx],
            token_count: chunk.tokenCount,
            chunk_index: chunk.index,
            metadata: {},
          }))

          for (let i = 0; i < chunkRows.length; i += 50) {
            const { error } = await service
              .from('chunks')
              .insert(chunkRows.slice(i, i + 50))
            if (error) throw new Error(`Failed to insert chunks: ${error.message}`)
          }

          chunkCount = chunks.length
        }

        await service
          .from('documents')
          .update({ status: 'ready', chunk_count: chunkCount, ingest_mode: 'chunks' })
          .eq('id', documentId)
          .eq('bot_id', botId)
      }

      return Response.json({ documentId, chunkCount })
    } catch (processingError) {
      console.error('[ingest/url POST] processing error', processingError)

      await service
        .from('documents')
        .update({
          status: 'failed',
          error_message:
            processingError instanceof Error ? processingError.message : 'Processing failed',
        })
        .eq('id', documentId)
        .eq('bot_id', botId)

      throw processingError
    }
  } catch (error) {
    console.error('[ingest/url POST]', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
