// Text extraction from PDF, DOCX, TXT files
// PDF: unpdf — ESM-native, works cleanly in Vercel/Turbopack serverless without
//      constructor mangling. pdf-parse@1.x caused "t is not a constructor" on Vercel
//      even with serverExternalPackages because pdfjs-dist internals get bundled.
// DOCX: mammoth
// TXT/CSV: raw utf-8

import mammoth from 'mammoth'
import { extractText as unpdfExtractText } from 'unpdf'

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
    const { text } = await unpdfExtractText(new Uint8Array(buffer), { mergePages: true })
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
