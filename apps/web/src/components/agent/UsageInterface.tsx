'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Play,
  Loader2,
  Copy,
  Check,
  AlertCircle,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AgentInput } from '@tempt/types'

interface UsageInterfaceProps {
  agentId: string
  agentName: string
  inputs: AgentInput[]
  outputFormat: string
  usagesRemaining: number | null
  /** Called after each successful run with updated usage count */
  onRun?: (result: { usagesRemaining: number | null }) => void
}

interface ExecuteResponse {
  output: string
  format: string
  durationMs: number
  usagesRemaining: number | null
}

// Build a Zod schema dynamically from the agent's input definition
function buildSchema(inputs: AgentInput[]): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const field of inputs) {
    let schema: z.ZodTypeAny

    if (field.type === 'number') {
      schema = z.coerce.number()
    } else {
      schema = z.string()
      if (field.maxLength) {
        schema = (schema as z.ZodString).max(field.maxLength)
      }
    }

    if (!field.required) {
      schema = schema.optional()
    } else {
      if (field.type !== 'number') {
        schema = (schema as z.ZodString).min(1, `${field.label} is required`)
      }
    }

    shape[field.name] = schema
  }

  return z.object(shape)
}

function OutputDisplay({
  output,
  format,
}: {
  output: string
  format: string
}): React.ReactElement {
  const [copied, setCopied] = useState(false)

  async function handleCopy(): Promise<void> {
    await navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative">
      <div className="absolute right-3 top-3 z-10">
        <button
          onClick={() => void handleCopy()}
          className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {format === 'code' ? (
        <pre className="overflow-x-auto rounded-lg bg-secondary p-4 pr-16 font-mono text-sm leading-relaxed">
          <code>{output}</code>
        </pre>
      ) : format === 'json' ? (
        <pre className="overflow-x-auto rounded-lg bg-secondary p-4 pr-16 font-mono text-sm leading-relaxed">
          {(() => {
            try {
              return JSON.stringify(JSON.parse(output), null, 2)
            } catch {
              return output
            }
          })()}
        </pre>
      ) : (
        <div className="rounded-lg bg-secondary p-4 pr-16 text-sm leading-relaxed whitespace-pre-wrap">
          {output}
        </div>
      )}
    </div>
  )
}

export function UsageInterface({
  agentId,
  inputs,
  outputFormat,
  usagesRemaining: initialUsagesRemaining,
  onRun,
}: UsageInterfaceProps): React.ReactElement {
  const [output, setOutput] = useState<string | null>(null)
  const [outputFormat_, setOutputFormat] = useState(outputFormat)
  const [durationMs, setDurationMs] = useState<number | null>(null)
  const [usagesRemaining, setUsagesRemaining] = useState(initialUsagesRemaining)
  const [isRunning, setIsRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)

  const schema = buildSchema(inputs)
  type FormValues = z.infer<typeof schema>

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const isExhausted = usagesRemaining !== null && usagesRemaining <= 0

  async function onSubmit(data: FormValues): Promise<void> {
    setRunError(null)
    setIsRunning(true)

    try {
      const res = await fetch(`/api/agents/${agentId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: data }),
      })

      const json = (await res.json()) as ExecuteResponse | { message: string }

      if (!res.ok) {
        const errMsg = (json as { message: string }).message || 'Execution failed'
        setRunError(errMsg)
        return
      }

      const result = json as ExecuteResponse
      setOutput(result.output)
      setOutputFormat(result.format)
      setDurationMs(result.durationMs)

      if (result.usagesRemaining !== null) {
        setUsagesRemaining(result.usagesRemaining)
      }

      onRun?.({ usagesRemaining: result.usagesRemaining })
    } catch {
      setRunError('Network error. Please check your connection and try again.')
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Input form */}
      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
        {inputs.map((field) => {
          const error = errors[field.name]

          return (
            <div key={field.name}>
              <label className="mb-1.5 block text-sm font-medium">
                {field.label}
                {field.required && (
                  <span className="ml-1 text-destructive" aria-hidden>*</span>
                )}
              </label>

              {field.type === 'textarea' ? (
                <textarea
                  {...register(field.name)}
                  placeholder={field.placeholder}
                  rows={4}
                  maxLength={field.maxLength}
                  className={cn(
                    'w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring',
                    error && 'border-destructive focus:ring-destructive'
                  )}
                />
              ) : field.type === 'select' && field.options ? (
                <select
                  {...register(field.name)}
                  className={cn(
                    'w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring',
                    error && 'border-destructive focus:ring-destructive'
                  )}
                >
                  <option value="">
                    {field.placeholder || `Select ${field.label.toLowerCase()}`}
                  </option>
                  {field.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : field.type === 'number' ? (
                <input
                  {...register(field.name)}
                  type="number"
                  placeholder={field.placeholder}
                  className={cn(
                    'w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring',
                    error && 'border-destructive focus:ring-destructive'
                  )}
                />
              ) : (
                <input
                  {...register(field.name)}
                  type="text"
                  placeholder={field.placeholder}
                  maxLength={field.maxLength}
                  className={cn(
                    'w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring',
                    error && 'border-destructive focus:ring-destructive'
                  )}
                />
              )}

              {error && (
                <p className="mt-1 text-xs text-destructive">
                  {String(error.message || 'Invalid value')}
                </p>
              )}
            </div>
          )
        })}

        {/* Usage counter */}
        {usagesRemaining !== null && (
          <p className={cn(
            'text-xs',
            usagesRemaining <= 2 ? 'text-yellow-500' : 'text-muted-foreground'
          )}>
            Uses remaining: {usagesRemaining}
          </p>
        )}

        {/* Error */}
        {runError && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{runError}</span>
          </div>
        )}

        {/* Run button */}
        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={isRunning || isExhausted}
        >
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running... (usually 5–15s)
            </>
          ) : isExhausted ? (
            'Usage limit reached'
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Run Agent
            </>
          )}
        </Button>
      </form>

      {/* Output area */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Output</h3>
          {durationMs && (
            <span className="text-xs text-muted-foreground">
              Completed in {(durationMs / 1000).toFixed(1)}s
            </span>
          )}
        </div>

        {isRunning ? (
          <div className="space-y-2 rounded-lg bg-secondary p-4">
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        ) : output !== null ? (
          <OutputDisplay output={output} format={outputFormat_} />
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-10 text-center">
            <Sparkles className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Run the agent to see the output
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
