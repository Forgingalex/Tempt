'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Shield,
  Loader2,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createAgentSchema, type CreateAgentInput } from '@/lib/validations/agent'
import { useCreateAgent } from '@/hooks/use-studio'
import { PLATFORM_CONTRACTS } from '@/lib/tempo'

const STEPS = [
  'Basic Info',
  'Prompt',
  'Inputs & Output',
  'Demos',
  'Pricing',
  'Review',
] as const

const CATEGORIES = [
  { value: 'writing', label: 'Writing' },
  { value: 'coding', label: 'Coding' },
  { value: 'art', label: 'Art / Creative' },
  { value: 'automation', label: 'Automation' },
  { value: 'research', label: 'Research' },
  { value: 'other', label: 'Other' },
] as const

const OUTPUT_FORMATS = [
  { value: 'text', label: 'Plain Text' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'code', label: 'Code' },
  { value: 'json', label: 'JSON' },
  { value: 'structured', label: 'Structured' },
] as const

const INPUT_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'select', label: 'Select' },
  { value: 'number', label: 'Number' },
] as const

/** Fields validated at each step for per-step validation */
const STEP_FIELDS: Record<number, (keyof CreateAgentInput)[]> = {
  0: ['name', 'description', 'doesNotDo', 'category'],
  1: ['systemPrompt'],
  2: ['inputs', 'outputFormat'],
  3: ['demos'],
  4: ['price', 'paymentToken', 'licenseType', 'llmProvider', 'llmModel', 'maxTokens', 'temperature'],
}

export function CreateAgentForm(): React.ReactElement {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [tagInput, setTagInput] = useState('')
  const createAgent = useCreateAgent()

  const form = useForm<CreateAgentInput>({
    resolver: zodResolver(createAgentSchema),
    defaultValues: {
      name: '',
      description: '',
      doesNotDo: '',
      category: 'other',
      tags: [],
      systemPrompt: '',
      promptTemplate: '',
      inputs: [{ name: 'input', label: 'Input', type: 'text', required: true }],
      outputFormat: 'text',
      demos: [
        { input: {}, output: '' },
        { input: {}, output: '' },
      ],
      price: '',
      paymentToken: PLATFORM_CONTRACTS.DEFAULT_PAYMENT_TOKEN || '0x0000000000000000000000000000000000000000',
      licenseType: 'one-time',
      llmProvider: 'openai',
      llmModel: 'gpt-4o',
      maxTokens: 2048,
      temperature: 0.7,
    },
    mode: 'onTouched',
  })

  const {
    register,
    control,
    handleSubmit,
    watch,
    trigger,
    setValue,
    formState: { errors },
  } = form

  const inputFields = useFieldArray({ control, name: 'inputs' })
  const demoFields = useFieldArray({ control, name: 'demos' })
  const watchedTags = watch('tags')
  const watchedInputs = watch('inputs')
  const watchedLicenseType = watch('licenseType')

  async function goNext(): Promise<void> {
    const fields = STEP_FIELDS[step]
    if (fields) {
      const valid = await trigger(fields)
      if (!valid) return
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  function goBack(): void {
    setStep((s) => Math.max(s - 1, 0))
  }

  function addTag(): void {
    const tag = tagInput.trim().toLowerCase()
    if (tag && !watchedTags.includes(tag) && watchedTags.length < 10) {
      setValue('tags', [...watchedTags, tag])
      setTagInput('')
    }
  }

  function removeTag(tag: string): void {
    setValue('tags', watchedTags.filter((t) => t !== tag))
  }

  async function onSubmit(data: CreateAgentInput): Promise<void> {
    try {
      await createAgent.mutateAsync(data)
      router.push('/studio')
    } catch {
      // Error state handled by createAgent.isError
    }
  }

  return (
    <div>
      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                i === step
                  ? 'bg-primary text-primary-foreground'
                  : i < step
                    ? 'bg-primary/20 text-primary cursor-pointer'
                    : 'bg-secondary text-muted-foreground'
              }`}
            >
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </button>
            <span
              className={`hidden text-xs sm:inline ${
                i === step ? 'font-medium text-foreground' : 'text-muted-foreground'
              }`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div className="hidden h-px w-4 bg-border sm:block" />
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Step 0: Basic Info */}
        {step === 0 && (
          <div className="space-y-6">
            <div>
              <Label htmlFor="name">Agent Name</Label>
              <Input
                id="name"
                placeholder="e.g. Blog Post Writer"
                {...register('name')}
                className="mt-1.5"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="description">What does this agent do?</Label>
              <Textarea
                id="description"
                placeholder="Describe what your agent does, who it's for, and what kind of output to expect."
                rows={4}
                {...register('description')}
                className="mt-1.5"
              />
              {errors.description && (
                <p className="mt-1 text-sm text-destructive">{errors.description.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="doesNotDo">
                What does this agent NOT do?
                <span className="ml-1 text-xs text-muted-foreground">(required)</span>
              </Label>
              <Textarea
                id="doesNotDo"
                placeholder="Be honest about limitations. This builds trust with buyers."
                rows={3}
                {...register('doesNotDo')}
                className="mt-1.5"
              />
              {errors.doesNotDo && (
                <p className="mt-1 text-sm text-destructive">{errors.doesNotDo.message}</p>
              )}
            </div>

            <div>
              <Label>Category</Label>
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.category && (
                <p className="mt-1 text-sm text-destructive">{errors.category.message}</p>
              )}
            </div>

            <div>
              <Label>Tags</Label>
              <div className="mt-1.5 flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="Add a tag"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addTag()
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addTag}>
                  Add
                </Button>
              </div>
              {watchedTags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {watchedTags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="ml-0.5 text-muted-foreground hover:text-foreground"
                      >
                        &times;
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 1: Prompt */}
        {step === 1 && (
          <div className="space-y-6">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="flex items-start gap-3 py-4">
                <Shield className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div className="text-sm">
                  <p className="font-medium">Your prompt is private</p>
                  <p className="mt-1 text-muted-foreground">
                    Prompts are encrypted before storage and never shown to buyers,
                    other sellers, or anyone else. Only our backend uses it to run
                    your agent.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div>
              <Label htmlFor="systemPrompt">System Prompt</Label>
              <Textarea
                id="systemPrompt"
                placeholder="Write the system prompt that powers your agent. This is the hidden prompt that buyers interact with through the agent interface."
                rows={10}
                {...register('systemPrompt')}
                className="mt-1.5 font-mono text-sm"
              />
              {errors.systemPrompt && (
                <p className="mt-1 text-sm text-destructive">{errors.systemPrompt.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="promptTemplate">
                Prompt Template
                <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
              </Label>
              <p className="mb-1.5 text-xs text-muted-foreground">
                {'Use {{fieldName}} placeholders to inject user inputs. Leave empty to send inputs as structured data.'}
              </p>
              <Textarea
                id="promptTemplate"
                placeholder={'e.g. Write a blog post about {{topic}} in a {{tone}} tone.'}
                rows={4}
                {...register('promptTemplate')}
                className="mt-1.5 font-mono text-sm"
              />
            </div>
          </div>
        )}

        {/* Step 2: Inputs & Output */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <Label>Input Fields</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    inputFields.append({
                      name: '',
                      label: '',
                      type: 'text',
                      required: true,
                    })
                  }
                  disabled={inputFields.fields.length >= 10}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add Field
                </Button>
              </div>

              <div className="space-y-4">
                {inputFields.fields.map((field, index) => (
                  <Card key={field.id}>
                    <CardContent className="pt-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label className="text-xs">Field Name (code)</Label>
                          <Input
                            placeholder="e.g. topic"
                            {...register(`inputs.${index}.name`)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Display Label</Label>
                          <Input
                            placeholder="e.g. Blog Topic"
                            {...register(`inputs.${index}.label`)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Type</Label>
                          <Controller
                            control={control}
                            name={`inputs.${index}.type`}
                            render={({ field: typeField }) => (
                              <Select value={typeField.value} onValueChange={typeField.onChange}>
                                <SelectTrigger className="mt-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {INPUT_TYPES.map((t) => (
                                    <SelectItem key={t.value} value={t.value}>
                                      {t.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <Label className="text-xs">Placeholder</Label>
                            <Input
                              placeholder="Optional"
                              {...register(`inputs.${index}.placeholder`)}
                              className="mt-1"
                            />
                          </div>
                          {inputFields.fields.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => inputFields.remove(index)}
                              className="h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {errors.inputs && (
                <p className="mt-1 text-sm text-destructive">
                  {typeof errors.inputs.message === 'string'
                    ? errors.inputs.message
                    : 'Please fix input field errors'}
                </p>
              )}
            </div>

            <div>
              <Label>Output Format</Label>
              <Controller
                control={control}
                name="outputFormat"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OUTPUT_FORMATS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
        )}

        {/* Step 3: Demos (minimum 2) */}
        {step === 3 && (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Provide at least 2 example input/output pairs. These are shown to buyers
              so they know what to expect.
            </p>

            {demoFields.fields.map((field, index) => (
              <Card key={field.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Demo {index + 1}</CardTitle>
                    {demoFields.fields.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => demoFields.remove(index)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Remove
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {watchedInputs.map((input, inputIdx) => (
                    <div key={inputIdx}>
                      <Label className="text-xs">
                        {input.label || input.name || `Input ${inputIdx + 1}`}
                      </Label>
                      <Input
                        placeholder={`Example value for ${input.name || 'input'}`}
                        {...register(`demos.${index}.input.${input.name || `field_${inputIdx}`}`)}
                        className="mt-1"
                      />
                    </div>
                  ))}
                  <div>
                    <Label className="text-xs">Expected Output</Label>
                    <Textarea
                      placeholder="What should the agent output for this input?"
                      rows={4}
                      {...register(`demos.${index}.output`)}
                      className="mt-1"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}

            {demoFields.fields.length < 5 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => demoFields.append({ input: {}, output: '' })}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Demo
              </Button>
            )}

            {errors.demos && (
              <p className="text-sm text-destructive">
                {typeof errors.demos.message === 'string'
                  ? errors.demos.message
                  : 'Please fix demo errors'}
              </p>
            )}
          </div>
        )}

        {/* Step 4: Pricing & Execution */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="price">Price (USD)</Label>
                <Input
                  id="price"
                  placeholder="e.g. 5.00"
                  {...register('price')}
                  className="mt-1.5"
                />
                <p className="mt-1 text-xs text-muted-foreground">TIP-20 token amount (6 decimals max)</p>
                {errors.price && (
                  <p className="mt-1 text-sm text-destructive">{errors.price.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="paymentToken">Payment Token Address</Label>
                <Input
                  id="paymentToken"
                  placeholder="0x..."
                  {...register('paymentToken')}
                  className="mt-1.5 font-mono text-xs"
                />
                {errors.paymentToken && (
                  <p className="mt-1 text-sm text-destructive">{errors.paymentToken.message}</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>License Type</Label>
                <Controller
                  control={control}
                  name="licenseType"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="one-time">One-time Purchase</SelectItem>
                        <SelectItem value="usage-based">Usage-based</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              {watchedLicenseType === 'usage-based' && (
                <div>
                  <Label htmlFor="usageLimit">Usage Limit (executions)</Label>
                  <Input
                    id="usageLimit"
                    type="number"
                    min={1}
                    placeholder="e.g. 100"
                    {...register('usageLimit', { valueAsNumber: true })}
                    className="mt-1.5"
                  />
                </div>
              )}
            </div>

            <div className="h-px bg-border" />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>LLM Provider</Label>
                <Controller
                  control={control}
                  name="llmProvider"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="anthropic">Anthropic</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div>
                <Label htmlFor="llmModel">Model</Label>
                <Input
                  id="llmModel"
                  placeholder="e.g. gpt-4o"
                  {...register('llmModel')}
                  className="mt-1.5"
                />
                {errors.llmModel && (
                  <p className="mt-1 text-sm text-destructive">{errors.llmModel.message}</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="maxTokens">Max Tokens</Label>
                <Input
                  id="maxTokens"
                  type="number"
                  min={100}
                  max={16000}
                  {...register('maxTokens', { valueAsNumber: true })}
                  className="mt-1.5"
                />
                {errors.maxTokens && (
                  <p className="mt-1 text-sm text-destructive">{errors.maxTokens.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="temperature">Temperature</Label>
                <Input
                  id="temperature"
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  {...register('temperature', { valueAsNumber: true })}
                  className="mt-1.5"
                />
                {errors.temperature && (
                  <p className="mt-1 text-sm text-destructive">{errors.temperature.message}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Review & Submit */}
        {step === 5 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Agent Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground">Name</span>
                    <p className="font-medium">{watch('name') || '--'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Category</span>
                    <p className="font-medium capitalize">{watch('category')}</p>
                  </div>
                </div>

                <div>
                  <span className="text-muted-foreground">Description</span>
                  <p className="mt-0.5">{watch('description') || '--'}</p>
                </div>

                <div>
                  <span className="text-muted-foreground">What it does NOT do</span>
                  <p className="mt-0.5">{watch('doesNotDo') || '--'}</p>
                </div>

                <div className="h-px bg-border" />

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <span className="text-muted-foreground">Price</span>
                    <p className="font-medium">{watch('price') || '--'} USD</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">License</span>
                    <p className="font-medium capitalize">
                      {watch('licenseType').replace('-', ' ')}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Model</span>
                    <p className="font-medium">
                      {watch('llmProvider')} / {watch('llmModel')}
                    </p>
                  </div>
                </div>

                <div className="h-px bg-border" />

                <div>
                  <span className="text-muted-foreground">
                    Input fields: {watchedInputs.length}
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {watchedInputs.map((input, i) => (
                      <Badge key={i} variant="outline">
                        {input.label || input.name}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-muted-foreground">
                    Demos: {demoFields.fields.length}
                  </span>
                </div>

                {watchedTags.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Tags</span>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {watchedTags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="flex items-start gap-3 py-4">
                <Shield className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div className="text-sm">
                  <p className="font-medium">Your agent will be reviewed before listing</p>
                  <p className="mt-1 text-muted-foreground">
                    After submission, your agent enters a review queue. Once approved,
                    it will be listed on the marketplace. Your prompt remains private
                    throughout.
                  </p>
                </div>
              </CardContent>
            </Card>

            {createAgent.error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {createAgent.error.message || 'Failed to create agent. Please try again.'}
              </div>
            )}
          </div>
        )}

        {/* Navigation buttons */}
        <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={goBack}
            disabled={step === 0}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back
          </Button>

          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={goNext}>
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" disabled={createAgent.isPending}>
              {createAgent.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit for Review'
              )}
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
