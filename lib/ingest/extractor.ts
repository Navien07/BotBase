// Text extraction from PDF, DOCX, TXT files
//
// PDF: Anthropic Claude API via raw fetch — avoids @anthropic-ai/sdk class
//      constructor which gets mangled by Turbopack regardless of serverExternalPackages.
//      Same issue affects pdf-parse, unpdf, pdf2json (all use pdfjs-dist).
//      Raw fetch uses only Node.js built-ins; no class instantiation.
// DOCX: mammoth via dynamic import (avoids module-level constructor mangling)
// TXT/CSV: raw utf-8

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
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
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
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Anthropic API error ${response.status}: ${errText}`)
  }

  const data = (await response.json()) as { content: Array<{ type: string; text?: string }> }
  const block = data.content.find((b) => b.type === 'text')
  return block?.text ?? ''
}

async function extractDocxWithMammoth(buffer: Buffer): Promise<string> {
  // Dynamic import avoids module-level class constructor mangling by Turbopack
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ buffer })
  return result.value
}

export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === 'application/pdf') {
    return extractPdfWithClaude(buffer)
  }

  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return extractDocxWithMammoth(buffer)
  }

  if (mimeType === 'text/plain' || mimeType === 'text/csv') {
    return buffer.toString('utf-8')
  }

  throw new Error(`Unsupported MIME type: ${mimeType}`)
}
