// Text extraction from PDF, DOCX, TXT files
// pdf-parse v2: class-based API — new PDFParse().parse(buffer) is CORRECT
// NOT the old pdfParse(buffer) function call

import mammoth from 'mammoth'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFParseModule = require('pdf-parse')
const PDFParse: { new (): { parse(buffer: Buffer): Promise<{ text: string }> } } =
  PDFParseModule.default ?? PDFParseModule

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
    const parser = new PDFParse()
    const result = await parser.parse(buffer)
    return result.text
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
