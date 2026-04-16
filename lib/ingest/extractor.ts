// Text extraction from PDF, DOCX, TXT files
//
// PDF: pdf-parse (serverExternalPackages in next.config.ts prevents Turbopack mangling)
// DOCX: mammoth via dynamic import (avoids module-level class constructor mangling)
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

async function extractPdfWithPdfParse(buffer: Buffer): Promise<string> {
  // Dynamic import avoids any module-level issues; pdf-parse is in serverExternalPackages
  const pdfParse = (await import('pdf-parse')).default
  const result = await pdfParse(buffer)
  return result.text ?? ''
}

async function extractDocxWithMammoth(buffer: Buffer): Promise<string> {
  // Dynamic import avoids module-level class constructor mangling by Turbopack
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ buffer })
  return result.value
}

export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === 'application/pdf') {
    return extractPdfWithPdfParse(buffer)
  }

  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return extractDocxWithMammoth(buffer)
  }

  if (mimeType === 'text/plain' || mimeType === 'text/csv') {
    return buffer.toString('utf-8')
  }

  throw new Error(`Unsupported MIME type: ${mimeType}`)
}
