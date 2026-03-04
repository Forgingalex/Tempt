import OpenAI from 'openai'
import { decryptPrompt, hashData } from './encryption.js'

interface ExecutionInput {
  agentId: string
  encryptedPrompt: string
  promptTemplate: string | null
  userInput: Record<string, unknown>
  llmProvider: string
  llmModel: string
  maxTokens: number
  temperature: number
}

interface ExecutionResult {
  output: string
  inputHash: string
  outputHash: string
  durationMs: number
  success: boolean
  errorType?: string
}

// SECURITY: Only place where prompts are decrypted. Prompts never leave this service.
export async function executeAgent(input: ExecutionInput): Promise<ExecutionResult> {
  const startTime = Date.now()

  try {
    const systemPrompt = decryptPrompt(input.encryptedPrompt)

    let userMessage: string
    if (input.promptTemplate) {
      userMessage = input.promptTemplate.replace(
        /\{\{(\w+)\}\}/g,
        (_, key) => String(input.userInput[key] || '')
      )
    } else {
      userMessage = JSON.stringify(input.userInput)
    }

    const inputHash = hashData(userMessage)

    let output: string

    if (input.llmProvider === 'openai') {
      output = await callOpenAI({
        systemPrompt,
        userMessage,
        model: input.llmModel,
        maxTokens: input.maxTokens,
        temperature: input.temperature,
      })
    } else if (input.llmProvider === 'anthropic') {
      output = await callAnthropic({
        systemPrompt,
        userMessage,
        model: input.llmModel,
        maxTokens: input.maxTokens,
        temperature: input.temperature,
      })
    } else {
      throw new Error(`Unsupported LLM provider: ${input.llmProvider}`)
    }

    const outputHash = hashData(output)

    return {
      output,
      inputHash,
      outputHash,
      durationMs: Date.now() - startTime,
      success: true,
    }
  } catch (error) {
    const errorType = error instanceof Error ? error.name : 'UnknownError'

    return {
      output: '',
      inputHash: hashData(JSON.stringify(input.userInput)),
      outputHash: '',
      durationMs: Date.now() - startTime,
      success: false,
      errorType,
    }
  }
}

interface LLMCallParams {
  systemPrompt: string
  userMessage: string
  model: string
  maxTokens: number
  temperature: number
}

async function callOpenAI(params: LLMCallParams): Promise<string> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })

  const response = await openai.chat.completions.create({
    model: params.model,
    messages: [
      { role: 'system', content: params.systemPrompt },
      { role: 'user', content: params.userMessage },
    ],
    max_tokens: params.maxTokens,
    temperature: params.temperature,
  })

  return response.choices[0]?.message?.content || ''
}

async function callAnthropic(params: LLMCallParams): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY || '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: params.maxTokens,
      system: params.systemPrompt,
      messages: [{ role: 'user', content: params.userMessage }],
    }),
  })

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`)
  }

  const data = await response.json()
  return data.content?.[0]?.text || ''
}
