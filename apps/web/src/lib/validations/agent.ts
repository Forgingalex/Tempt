import { z } from 'zod'

export const agentInputSchema = z.object({
  name: z.string().min(1, 'Field name is required').max(50),
  label: z.string().min(1, 'Field label is required').max(100),
  type: z.enum(['text', 'textarea', 'select', 'number']),
  placeholder: z.string().max(200).optional(),
  required: z.boolean(),
  options: z.array(z.string().min(1)).optional(),
  maxLength: z.number().int().positive().optional(),
})

export const agentDemoSchema = z.object({
  input: z.record(z.string(), z.string()),
  output: z.string().min(1, 'Demo output is required'),
})

/**
 * Create agent schema. systemPrompt is plaintext here; encrypted server-side
 * before DB insert. Never stored as plaintext.
 */
export const createAgentSchema = z.object({
  name: z
    .string()
    .min(3, 'Name must be at least 3 characters')
    .max(100, 'Name must be under 100 characters'),
  description: z
    .string()
    .min(20, 'Description must be at least 20 characters')
    .max(2000, 'Description must be under 2000 characters'),
  doesNotDo: z
    .string()
    .min(10, 'Limitations must be at least 10 characters')
    .max(1000, 'Limitations must be under 1000 characters'),
  category: z.enum(['writing', 'coding', 'art', 'automation', 'research', 'other']),
  tags: z
    .array(z.string().min(1).max(30))
    .max(10, 'Maximum 10 tags')
    .default([]),

  systemPrompt: z
    .string()
    .min(10, 'System prompt must be at least 10 characters')
    .max(10000, 'System prompt must be under 10000 characters'),
  promptTemplate: z.string().max(5000).optional(),

  inputs: z
    .array(agentInputSchema)
    .min(1, 'At least one input field is required')
    .max(10, 'Maximum 10 input fields'),
  outputFormat: z.enum(['text', 'markdown', 'code', 'json', 'structured']),

  // Minimum 2 demos mandatory per CLAUDE.md
  demos: z
    .array(agentDemoSchema)
    .min(2, 'At least 2 demo examples are required')
    .max(5, 'Maximum 5 demo examples'),

  // TIP-20 uses 6 decimals
  price: z
    .string()
    .regex(/^\d+(\.\d{1,6})?$/, 'Price must be a valid number with up to 6 decimals'),
  paymentToken: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Must be a valid token address'),
  licenseType: z.enum(['one-time', 'usage-based']),
  usageLimit: z.number().int().positive().optional(),

  llmProvider: z.enum(['openai', 'anthropic']),
  llmModel: z.string().min(1, 'Model is required').max(50),
  maxTokens: z.number().int().min(100).max(16000),
  temperature: z.number().min(0).max(2),
})

export type CreateAgentInput = z.infer<typeof createAgentSchema>

/**
 * Update schema. All fields optional. Prompt updates go through
 * a separate versioning flow, not this endpoint.
 */
export const updateAgentSchema = z.object({
  name: z
    .string()
    .min(3, 'Name must be at least 3 characters')
    .max(100)
    .optional(),
  description: z
    .string()
    .min(20, 'Description must be at least 20 characters')
    .max(2000)
    .optional(),
  doesNotDo: z
    .string()
    .min(10, 'Limitations must be at least 10 characters')
    .max(1000)
    .optional(),
  category: z.enum(['writing', 'coding', 'art', 'automation', 'research', 'other']).optional(),
  tags: z.array(z.string().min(1).max(30)).max(10).optional(),
  demos: z.array(agentDemoSchema).min(2).max(5).optional(),
  price: z
    .string()
    .regex(/^\d+(\.\d{1,6})?$/, 'Price must be a valid number with up to 6 decimals')
    .optional(),
  maxTokens: z.number().int().min(100).max(16000).optional(),
  temperature: z.number().min(0).max(2).optional(),
})

export type UpdateAgentInput = z.infer<typeof updateAgentSchema>
