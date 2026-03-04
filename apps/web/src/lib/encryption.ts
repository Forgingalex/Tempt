import { createCipheriv, randomBytes, createHash } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16

// Must match the key used by apps/server/src/services/encryption.ts
function getEncryptionKey(): Buffer {
  const key = process.env.PROMPT_ENCRYPTION_KEY
  if (!key) {
    throw new Error('PROMPT_ENCRYPTION_KEY is not set')
  }

  if (key.length !== 32) {
    return createHash('sha256').update(key).digest()
  }

  return Buffer.from(key, 'utf-8')
}

// Format: base64(iv):base64(authTag):base64(ciphertext)
// Must match server's decryptPrompt() format exactly.
export function encryptPrompt(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)

  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'base64')
  encrypted += cipher.final('base64')

  const authTag = cipher.getAuthTag()

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`
}
