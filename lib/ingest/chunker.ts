// Token-based text chunker
// 500 tokens per chunk, 50 token overlap
// Uses gpt-tokenizer (cl100k_base) for accurate token counting

import { encode, decode } from 'gpt-tokenizer'

const CHUNK_SIZE = 500   // tokens per chunk
const OVERLAP = 50       // overlap tokens between chunks

export interface TextChunk {
  content: string
  tokenCount: number
  index: number
}

export function chunkText(text: string): TextChunk[] {
  const trimmed = text.trim()
  if (!trimmed) return []

  const tokens = encode(trimmed)
  if (tokens.length === 0) return []

  const chunks: TextChunk[] = []
  let start = 0

  while (start < tokens.length) {
    const end = Math.min(start + CHUNK_SIZE, tokens.length)
    const chunkTokens = tokens.slice(start, end)
    const content = decode(Array.from(chunkTokens)).trim()

    if (content.length > 0) {
      chunks.push({
        content,
        tokenCount: chunkTokens.length,
        index: chunks.length,
      })
    }

    if (end >= tokens.length) break
    start += CHUNK_SIZE - OVERLAP
  }

  return chunks
}
