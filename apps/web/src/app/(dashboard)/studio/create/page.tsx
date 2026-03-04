import { CreateAgentForm } from '@/components/studio/CreateAgentForm'

export default function CreateAgentPage(): React.ReactElement {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Create Agent</h1>
        <p className="mt-1 text-muted-foreground">
          Define your AI agent, set its prompt, and list it on the marketplace.
        </p>
      </div>
      <CreateAgentForm />
    </div>
  )
}
