import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { extractText } from '@/lib/ingest/extractor'
import { chunkText } from '@/lib/ingest/chunker'
import { embedTexts } from '@/lib/ingest/embedder'
import { isQnADocument, parseQnA } from '@/lib/ingest/qna-parser'

export const maxDuration = 60

const ProcessSchema = z.object({
  documentId: z.string().uuid(),
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

  const parsed = ProcessSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { documentId } = parsed.data
  const service = createServiceClient()

  // 1. Fetch document record — verify it belongs to this botId
  const { data: doc, error: fetchError } = await service
    .from('documents')
    .select('id, bot_id, filename, file_path, mime_type, category, folder, status')
    .eq('id', documentId)
    .eq('bot_id', botId)
    .single()

  if (fetchError || !doc) {
    return Response.json({ error: 'Document not found' }, { status: 404 })
  }

  // URL-sourced documents are processed inline in the url route
  if (doc.category === 'url') {
    return Response.json({ error: 'URL documents are processed inline' }, { status: 400 })
  }

  // 2. Set status: processing
  await service
    .from('documents')
    .update({ status: 'processing' })
    .eq('id', documentId)
    .eq('bot_id', botId)

  try {
    // 3. Download file from Supabase Storage
    const { data: blob, error: downloadError } = await service.storage
      .from('bot-files')
      .download(doc.file_path)

    if (downloadError || !blob) {
      throw new Error(`Failed to download file: ${downloadError?.message ?? 'no data'}`)
    }

    const arrayBuffer = await blob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 4. Extract text
    const mimeType = doc.mime_type ?? 'text/plain'
    const text = await extractText(buffer, mimeType)

    let chunkCount = 0

    // 5. Detect Q&A vs regular chunks
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

        // Insert FAQs in batches of 50
        for (let i = 0; i < faqRows.length; i += 50) {
          const { error: faqError } = await service
            .from('faqs')
            .insert(faqRows.slice(i, i + 50))
          if (faqError) throw new Error(`Failed to insert FAQs: ${faqError.message}`)
        }

        chunkCount = pairs.length
      }

      await service
        .from('documents')
        .update({ status: 'ready', chunk_count: chunkCount, ingest_mode: 'qna' })
        .eq('id', documentId)
        .eq('bot_id', botId)
    } else {
      // 6. Chunk → embed → bulk insert
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
          metadata: doc.folder ? { folder: doc.folder } : {},
        }))

        // Insert chunks in batches of 50
        for (let i = 0; i < chunkRows.length; i += 50) {
          const { error: chunkError } = await service
            .from('chunks')
            .insert(chunkRows.slice(i, i + 50))
          if (chunkError) throw new Error(`Failed to insert chunks: ${chunkError.message}`)
        }

        chunkCount = chunks.length
      }

      await service
        .from('documents')
        .update({ status: 'ready', chunk_count: chunkCount, ingest_mode: 'chunks' })
        .eq('id', documentId)
        .eq('bot_id', botId)
    }

    return Response.json({ success: true, documentId, chunkCount })
  } catch (error) {
    console.error('[ingest/process POST]', error)

    // 7. On any error: set status failed + error_message
    await service
      .from('documents')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Processing failed',
      })
      .eq('id', documentId)
      .eq('bot_id', botId)

    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
