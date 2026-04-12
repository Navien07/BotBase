// Text extraction from PDF, DOCX, TXT files
//
// PDF: Anthropic Claude API (document content block) — the only approach that
//      works reliably on Vercel + Next.js 16 Turbopack. Every npm PDF library
//      (pdf-parse, unpdf, pdf2json) wraps pdfjs-dist, whose class constructors
//      get mangled by Turbopack regardless of serverExternalPackages.
//      Claude Haiku is cheap (~$0.001/page) and only runs once per upload.
// DOCX: mammoth
// TXT/CSV: raw utf-8

import Anthropic from '@anthropic-ai/sdk'
import mammoth from 'mammoth'

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
])

export function isSupportedMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimeType)
}

async function extractPdfWithClaude(buffer: Buffer): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: buffer.toString('base64'),
            },
          },
          {
            type: 'text',
            text: 'Extract and return all the text content from this document. Preserve structure and headings. Return only the extracted text — no commentary, no preamble.',
          },
        ],
      },
    ],
  })

  const block = response.content.find((b) => b.type === 'text')
  return block?.type === 'text' ? block.text : ''
}

export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === 'application/pdf') {
    return extractPdfWithClaude(buffer)
  }

  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }

  if (mimeType === 'text/plain' || mimeType === 'text/csv') {
    return buffer.toString('utf-8')
  }

  throw new Error(`Unsupported MIME type: ${mimeType}`)
}
