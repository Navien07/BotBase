// Text extraction from PDF, DOCX, TXT files
// PDF: pdf-parse@1.x — static top-level import so Turbopack's serverExternalPackages
//      can statically analyze and exclude it from the bundle. Dynamic require() inside
//      function bodies bypasses static analysis and causes Turbopack to bundle the module,
//      which mangles class constructors ("t is not a constructor"). v1 uses old pdfjs-dist
//      with no canvas/DOMMatrix dependency so top-level import is safe.
// DOCX: mammoth
// TXT/CSV: raw utf-8

import mammoth from 'mammoth'
import pdfParse from 'pdf-parse'

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
    const data = await pdfParse(buffer)
    return data.text
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
