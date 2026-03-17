import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AgentDemo, AgentInput } from '@tempt/types'

interface DemoSectionProps {
  demos: AgentDemo[]
  inputs: AgentInput[]
}

export function DemoSection({ demos, inputs }: DemoSectionProps): React.ReactElement {
  if (!demos || demos.length === 0) {
    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Demo Examples</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No demos available for this agent.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="text-base">Demo Examples</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {demos.map((demo, i) => (
          <div key={i} className="space-y-3">
            {demos.length > 1 && (
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Example {i + 1}
              </p>
            )}

            {/* Input fields */}
            <div className="rounded-lg bg-secondary p-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Input</p>
              <div className="space-y-2">
                {inputs.map((field) => {
                  const value = demo.input[field.name]
                  if (!value) return null
                  return (
                    <div key={field.name}>
                      <span className="text-xs text-muted-foreground">{field.label}: </span>
                      <span className="font-mono text-sm">{value}</span>
                    </div>
                  )
                })}
                {/* Fallback if no matching input fields */}
                {inputs.length === 0 && (
                  <pre className="whitespace-pre-wrap font-mono text-sm">
                    {JSON.stringify(demo.input, null, 2)}
                  </pre>
                )}
              </div>
            </div>

            {/* Output */}
            <div className="rounded-lg bg-secondary p-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Output</p>
              <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
                {demo.output}
              </pre>
            </div>

            {i < demos.length - 1 && <div className="border-t border-border" />}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
