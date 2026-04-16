const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
])

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

export interface FileValidationResult {
  valid: boolean
  error?: string
}

export function validateFile(file: {
  size: number
  type: string
  name: string
}): FileValidationResult {
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`,
    }
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return {
      valid: false,
      error: 'File type not allowed. Use PDF, DOCX, TXT, or CSV.',
    }
  }
  return { valid: true }
}
