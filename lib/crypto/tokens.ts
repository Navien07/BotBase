import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
  const key = process.env.TOKEN_ENCRYPTION_KEY
  if (!key || key.length !== 64) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)')
  }
  return Buffer.from(key, 'hex')
}

export async function encrypt(plaintext: string): Promise<string> {
  const key = getKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':')
}

export async function decrypt(ciphertext: string): Promise<string> {
  const key = getKey()
  const [ivHex, tagHex, encryptedHex] = ciphertext.split(':')
  if (!ivHex || !tagHex || !encryptedHex) throw new Error('Invalid ciphertext format')
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return decrypted.toString('utf8')
}

export function maskToken(raw: string): string {
  if (raw.length <= 4) return '••••'
  return '••••••••' + raw.slice(-4)
}
