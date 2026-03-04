import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatUnits, parseUnits } from 'viem'
import { TIP20_DECIMALS } from './tempo'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function formatTokenAmount(amount: bigint, decimals: number = TIP20_DECIMALS): string {
  return formatUnits(amount, decimals)
}

export function parseTokenAmount(amount: string, decimals: number = TIP20_DECIMALS): bigint {
  return parseUnits(amount, decimals)
}

export function formatCurrency(
  amount: bigint,
  symbol: string = 'USD',
  decimals: number = TIP20_DECIMALS
): string {
  const formatted = formatTokenAmount(amount, decimals)
  const num = parseFloat(formatted)
  return `${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`
}

export function shortenAddress(address: string, chars: number = 4): string {
  if (!address) return ''
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

export function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffMinutes = Math.floor(diffMs / (1000 * 60))

  if (diffMs > 0) {
    if (diffDays > 0) return `in ${diffDays} day${diffDays === 1 ? '' : 's'}`
    if (diffHours > 0) return `in ${diffHours} hour${diffHours === 1 ? '' : 's'}`
    if (diffMinutes > 0) return `in ${diffMinutes} minute${diffMinutes === 1 ? '' : 's'}`
    return 'in a moment'
  } else {
    const absDays = Math.abs(diffDays)
    const absHours = Math.abs(diffHours)
    const absMinutes = Math.abs(diffMinutes)
    if (absDays > 0) return `${absDays} day${absDays === 1 ? '' : 's'} ago`
    if (absHours > 0) return `${absHours} hour${absHours === 1 ? '' : 's'} ago`
    if (absMinutes > 0) return `${absMinutes} minute${absMinutes === 1 ? '' : 's'} ago`
    return 'just now'
  }
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim()
}
