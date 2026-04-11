import { describe, it, expect } from 'vitest'
import { encrypt, decrypt, maskToken } from '@/lib/crypto/tokens'

describe('crypto/tokens', () => {
  it('encrypt → decrypt roundtrip', async () => {
    const plaintext = 'super-secret-token-12345'
    const ciphertext = await encrypt(plaintext)
    const result = await decrypt(ciphertext)
    expect(result).toBe(plaintext)
  })

  it('produces different ciphertext each call (random IV)', async () => {
    const plaintext = 'hello'
    const a = await encrypt(plaintext)
    const b = await encrypt(plaintext)
    expect(a).not.toBe(b)
  })

  it('maskToken: short tokens return ••••', () => {
    expect(maskToken('ab')).toBe('••••')
    expect(maskToken('abcd')).toBe('••••')
  })

  it('maskToken: long tokens show last 4 chars', () => {
    expect(maskToken('abc123xyz789')).toBe('••••••••z789')
    expect(maskToken('EAABwzLixnjYBO_TOKEN')).toBe('••••••••OKEN')
  })

  it('tampered ciphertext throws on decrypt', async () => {
    const plaintext = 'original-secret-value'
    const ciphertext = await encrypt(plaintext)

    // Tamper: flip the last two hex chars of the encrypted payload
    const parts = ciphertext.split(':')
    const lastHex = parts[2]
    const flipped = lastHex.slice(0, -2) + (lastHex.slice(-2) === '00' ? 'ff' : '00')
    const tampered = [parts[0], parts[1], flipped].join(':')

    await expect(decrypt(tampered)).rejects.toThrow()
  })
})
