import { verifyMessage, type Address } from 'viem'

/**
 * SIWE (Sign-In with Ethereum) message utilities adapted for Tempo.
 *
 * Implements EIP-4361 message format:
 * https://eips.ethereum.org/EIPS/eip-4361
 */

export interface SiweMessageParams {
  domain: string
  address: string
  uri: string
  nonce: string
  chainId?: number
  statement?: string
  issuedAt?: string
  expirationTime?: string
}

/**
 * Build an EIP-4361 compliant SIWE message string.
 */
export function createSiweMessage(params: SiweMessageParams): string {
  const {
    domain,
    address,
    uri,
    nonce,
    chainId = 42431,
    statement = 'Sign in to Tempt — AI Agent Marketplace',
    issuedAt = new Date().toISOString(),
    expirationTime,
  } = params

  let message = `${domain} wants you to sign in with your Ethereum account:\n`
  message += `${address}\n\n`
  message += `${statement}\n\n`
  message += `URI: ${uri}\n`
  message += `Version: 1\n`
  message += `Chain ID: ${chainId}\n`
  message += `Nonce: ${nonce}\n`
  message += `Issued At: ${issuedAt}`

  if (expirationTime) {
    message += `\nExpiration Time: ${expirationTime}`
  }

  return message
}

export interface ParsedSiweMessage {
  domain: string
  address: string
  statement: string
  uri: string
  version: string
  chainId: number
  nonce: string
  issuedAt: string
  expirationTime?: string
}

/**
 * Parse an EIP-4361 SIWE message string into its component fields.
 */
export function parseSiweMessage(message: string): ParsedSiweMessage | null {
  try {
    const lines = message.split('\n')

    const domainLine = lines[0]
    if (!domainLine) return null
    const domain = domainLine.replace(' wants you to sign in with your Ethereum account:', '')

    const address = lines[1]?.trim()
    if (!address) return null

    // Statement is between the address and the URI line (skip blank lines)
    const statementParts: string[] = []
    let lineIdx = 3 // skip domain, address, blank line
    while (lineIdx < lines.length && !lines[lineIdx]?.startsWith('URI:')) {
      if (lines[lineIdx]?.trim()) {
        statementParts.push(lines[lineIdx]!.trim())
      }
      lineIdx++
    }
    // If we hit a blank line before URI, skip it
    if (lines[lineIdx]?.trim() === '') lineIdx++

    const fields: Record<string, string> = {}
    for (let i = lineIdx; i < lines.length; i++) {
      const line = lines[i]
      if (!line) continue
      const colonIdx = line.indexOf(': ')
      if (colonIdx === -1) continue
      const key = line.slice(0, colonIdx).trim()
      const value = line.slice(colonIdx + 2).trim()
      fields[key] = value
    }

    return {
      domain,
      address,
      statement: statementParts.join(' ') || '',
      uri: fields['URI'] || '',
      version: fields['Version'] || '1',
      chainId: parseInt(fields['Chain ID'] || '0', 10),
      nonce: fields['Nonce'] || '',
      issuedAt: fields['Issued At'] || '',
      expirationTime: fields['Expiration Time'],
    }
  } catch {
    return null
  }
}

export interface VerifySiweResult {
  success: boolean
  address?: string
  error?: string
}

/**
 * Verify a SIWE message signature.
 * Validates: signature, domain, chainId, nonce, and expiration.
 */
export async function verifySiweSignature(params: {
  message: string
  signature: `0x${string}`
  expectedDomain: string
  expectedNonce: string
  expectedChainId?: number
}): Promise<VerifySiweResult> {
  const {
    message,
    signature,
    expectedDomain,
    expectedNonce,
    expectedChainId = 42431,
  } = params

  const parsed = parseSiweMessage(message)
  if (!parsed) {
    return { success: false, error: 'Failed to parse SIWE message' }
  }

  // Validate domain
  if (parsed.domain !== expectedDomain) {
    return { success: false, error: 'Domain mismatch' }
  }

  // Validate chain ID (Tempo Testnet)
  if (parsed.chainId !== expectedChainId) {
    return { success: false, error: 'Chain ID mismatch' }
  }

  // Validate nonce
  if (parsed.nonce !== expectedNonce) {
    return { success: false, error: 'Nonce mismatch' }
  }

  // Check expiration
  if (parsed.expirationTime) {
    const expiry = new Date(parsed.expirationTime)
    if (expiry < new Date()) {
      return { success: false, error: 'Message expired' }
    }
  }

  // Verify cryptographic signature via viem
  try {
    const valid = await verifyMessage({
      address: parsed.address as Address,
      message,
      signature,
    })

    if (!valid) {
      return { success: false, error: 'Invalid signature' }
    }

    return { success: true, address: parsed.address }
  } catch {
    return { success: false, error: 'Signature verification failed' }
  }
}
