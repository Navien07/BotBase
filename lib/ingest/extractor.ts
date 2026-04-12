// Text extraction from PDF, DOCX, TXT files
// PDF: uses unpdf (serverless-compatible, no DOMMatrix/canvas dependencies)
// DOCX: mammoth
// TXT/CSV: raw utf-8

import mammoth from 'mammoth'
import { extractText as unpdfExtractText, getDocumentProxy } from 'unpdf'

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
])

export function isSupportedMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimeType)
}

export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === 'application/pdf') {
    const pdf = await getDocumentProxy(new Uint8Array(buffer))
    const { text } = await unpdfExtractText(pdf, { mergePages: true })
    return text
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
