// In-memory nonce store. Replace with Redis for multi-instance deployments.

const NONCE_TTL_MS = 5 * 60 * 1000

interface NonceEntry {
  createdAt: number
}

class NonceStore {
  private nonces = new Map<string, NonceEntry>()

  constructor() {
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.cleanup(), 60_000)
    }
  }

  create(): string {
    const nonce = crypto.randomUUID()
    this.nonces.set(nonce, { createdAt: Date.now() })
    return nonce
  }

  consume(nonce: string): boolean {
    const entry = this.nonces.get(nonce)
    if (!entry) return false

    this.nonces.delete(nonce)

    if (Date.now() - entry.createdAt > NONCE_TTL_MS) {
      return false
    }

    return true
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [nonce, entry] of this.nonces) {
      if (now - entry.createdAt > NONCE_TTL_MS) {
        this.nonces.delete(nonce)
      }
    }
  }
}

// Singleton — survives hot reloads in dev
const globalForNonce = globalThis as unknown as {
  nonceStore: NonceStore | undefined
}

export const nonceStore: NonceStore =
  globalForNonce.nonceStore ?? new NonceStore()

if (process.env.NODE_ENV !== 'production') {
  globalForNonce.nonceStore = nonceStore
}
