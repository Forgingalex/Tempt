import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { decryptPrompt, hashData } from '@/lib/encryption'

// ============================================================
// In-memory rate limiter (per user per agent, 10 req/min)
// In production, replace with Redis-backed rate limiting.
// ============================================================
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(key: string, maxPerMinute: number): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(key)

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 60_000 })
    return true
  }

  if (entry.count >= maxPerMinute) {
    return false
  }

  entry.count++
  return true
}

// Periodically clean up expired rate limit entries to avoid memory leak
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitMap.entries()) {
    if (entry.resetAt < now) rateLimitMap.delete(key)
  }
}, 5 * 60_000)

// ============================================================
// Validation
// ============================================================
const executeSchema = z.object({
  input: z.record(z.string(), z.unknown()),
})

// ============================================================
// LLM callers (server-side only — never called from client)
// ============================================================
interface LLMParams {
  systemPrompt: string
  userMessage: string
  model: string
  maxTokens: number
  temperature: number
}

async function callOpenAI(params: LLMParams): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || apiKey === 'sk-placeholder') {
    throw new Error('OpenAI API key not configured')
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userMessage },
      ],
      max_tokens: params.maxTokens,
      temperature: params.temperature,
    }),
  })

  if (!res.ok) {
    // Do NOT forward the raw error — it might contain API key details
    throw new Error(`LLM call failed (${res.status})`)
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  return data.choices?.[0]?.message?.content ?? ''
}

async function callAnthropic(params: LLMParams): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'sk-ant-placeholder') {
    throw new Error('Anthropic API key not configured')
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: params.maxTokens,
      temperature: params.temperature,
      system: params.systemPrompt,
      messages: [{ role: 'user', content: params.userMessage }],
    }),
  })

  if (!res.ok) {
    throw new Error(`LLM call failed (${res.status})`)
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>
  }
  return data.content?.find((c) => c.type === 'text')?.text ?? ''
}

// ============================================================
// Route handler
// ============================================================
type RouteContext = { params: Promise<{ id: string }> }

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  // 1. Authenticate
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
  }

  const { id: agentId } = await context.params

  // 2. Rate limit — 10 executions per minute per user per agent
  const rateLimitKey = `exec:${session.user.id}:${agentId}`
  if (!checkRateLimit(rateLimitKey, 10)) {
    return NextResponse.json(
      { message: 'Rate limit exceeded. Please wait a moment before running again.' },
      { status: 429 }
    )
  }

  // 3. Parse input
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = executeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: 'Invalid input format' }, { status: 400 })
  }

  const { input } = parsed.data

  // 4. Authorize — verify the user has an active purchase for this agent
  const purchase = await prisma.purchase.findFirst({
    where: {
      agentId,
      buyerId: session.user.id,
      status: { in: ['ESCROWED', 'ACCEPTED', 'AUTO_RELEASED'] },
    },
    select: {
      id: true,
      status: true,
      usagesRemaining: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!purchase) {
    // Return 403 without revealing if agent exists
    return NextResponse.json({ message: 'Access denied' }, { status: 403 })
  }

  // 5. Check usage limits
  if (purchase.usagesRemaining !== null && purchase.usagesRemaining <= 0) {
    return NextResponse.json({ message: 'Usage limit reached for this purchase' }, { status: 403 })
  }

  // 6. Retrieve agent — MUST include encryptedPrompt
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: {
      id: true,
      encryptedPrompt: true,
      promptTemplate: true,
      llmProvider: true,
      llmModel: true,
      maxTokens: true,
      temperature: true,
      outputFormat: true,
      licenseType: true,
    },
  })

  if (!agent) {
    return NextResponse.json({ message: 'Access denied' }, { status: 403 })
  }

  const startTime = Date.now()
  let systemPrompt: string

  // 7. Decrypt prompt — server-side only
  // SECURITY: systemPrompt NEVER leaves this function.
  // Do NOT log it, return it, or include it in error messages.
  try {
    systemPrompt = decryptPrompt(agent.encryptedPrompt)
  } catch {
    console.error('[execute] Failed to decrypt prompt for agent:', agentId)
    return NextResponse.json(
      { message: 'Agent execution failed. Please try again.' },
      { status: 500 }
    )
  }

  // 8. Build user message from input
  let userMessage: string
  if (agent.promptTemplate) {
    // Replace {{fieldName}} placeholders with user input values
    userMessage = agent.promptTemplate.replace(
      /\{\{(\w+)\}\}/g,
      (_, key: string) => String(input[key] ?? '')
    )
  } else {
    // Format input as structured text
    userMessage = Object.entries(input)
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join('\n')
  }

  // Hash for logging — never log raw input
  const inputHash = hashData(JSON.stringify(input))

  // 9. Call LLM (server-side only)
  let output = ''
  let success = false
  let errorType: string | null = null

  try {
    if (agent.llmProvider === 'openai') {
      output = await callOpenAI({
        systemPrompt,
        userMessage,
        model: agent.llmModel,
        maxTokens: agent.maxTokens,
        temperature: agent.temperature,
      })
    } else if (agent.llmProvider === 'anthropic') {
      output = await callAnthropic({
        systemPrompt,
        userMessage,
        model: agent.llmModel,
        maxTokens: agent.maxTokens,
        temperature: agent.temperature,
      })
    } else {
      throw new Error(`Unknown provider: ${agent.llmProvider}`)
    }

    if (!output || output.trim().length === 0) {
      throw new Error('Empty response from LLM')
    }

    success = true
  } catch (err) {
    errorType = err instanceof Error ? err.constructor.name : 'UnknownError'
    console.error('[execute] LLM call failed for agent:', agentId, '— type:', errorType)
    // SECURITY: Do NOT return err.message — it might expose LLM internals
  }

  const durationMs = Date.now() - startTime
  const outputHash = success ? hashData(output) : ''

  // 10. Log execution — hashed, never raw
  try {
    await prisma.$transaction(async (tx) => {
      await tx.execution.create({
        data: {
          purchaseId: purchase.id,
          agentId,
          inputHash,
          outputHash,
          // Store raw data temporarily for dispute resolution — auto-cleanup after 14 days
          rawInput: JSON.stringify(input),
          rawOutput: success ? output : null,
          durationMs,
          success,
          errorType,
        },
      })

      // 11. Decrement usage for usage-based agents on success only
      if (
        success &&
        agent.licenseType === 'USAGE_BASED' &&
        purchase.usagesRemaining !== null
      ) {
        await tx.purchase.update({
          where: { id: purchase.id },
          data: { usagesRemaining: { decrement: 1 } },
        })
      }

      // Increment agent execution count
      await tx.agent.update({
        where: { id: agentId },
        data: { totalExecutions: { increment: 1 } },
      })
    })
  } catch (dbError) {
    // DB logging failure is non-fatal for the user
    console.error('[execute] Failed to log execution:', dbError)
  }

  // 12. Return response
  if (!success) {
    return NextResponse.json(
      { message: 'Agent execution failed. This use was not counted. Please try again.' },
      { status: 500 }
    )
  }

  // Calculate updated usage count
  const usagesRemaining =
    agent.licenseType === 'USAGE_BASED' && purchase.usagesRemaining !== null
      ? purchase.usagesRemaining - 1
      : null

  return NextResponse.json({
    output,
    format: agent.outputFormat.toLowerCase(),
    durationMs,
    usagesRemaining,
  })
}
