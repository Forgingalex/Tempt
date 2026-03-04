import { NextResponse } from 'next/server'
import { nonceStore } from './store'

export function GET(): NextResponse {
  const nonce = nonceStore.create()
  return NextResponse.json({ nonce })
}
