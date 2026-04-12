// Text extraction from PDF, DOCX, TXT files
// PDF: pdf2json — pure CJS parser, no pdfjs-dist dependency, no constructor
//      mangling issues on Vercel/Turbopack. pdf-parse and unpdf both wrap
//      pdfjs-dist which gets bundled by Turbopack and breaks ("t is not a
//      constructor") even with serverExternalPackages.
// DOCX: mammoth
// TXT/CSV: raw utf-8

import { PDFParser } from 'pdf2json'
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

function parsePdfBuffer(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const parser = new PDFParser(null, true) // needRawText
    parser.on('pdfParser_dataError', (err) => {
      reject(err instanceof Error ? err : new Error(String(err)))
    })
    parser.on('pdfParser_dataReady', () => {
      resolve(parser.getRawTextContent())
    })
    parser.parseBuffer(buffer)
  })
}

export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === 'application/pdf') {
    return parsePdfBuffer(buffer)
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
