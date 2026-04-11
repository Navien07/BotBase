import Anthropic from '@anthropic-ai/sdk'
import type { FlowData, FlowNode } from '@/types/database'
import type { PipelineContext } from '@/lib/pipeline/types'

// ─── Public interfaces ────────────────────────────────────────────────────────

export interface ScriptContext {
  currentNodeId: string | null
  variables: Record<string, string>
  conversationHistory: Array<{ role: string; content: string }>
  botId: string
  language: string
}

export interface ScriptStepResult {
  response: string | null
  nextNodeId: string | null
  capturedVariables: Record<string, string>
  isComplete: boolean
  requiresUserInput: boolean
  quickReplies: string[]
  triggerBooking?: boolean
  handoffRequired?: boolean
}

export interface ScriptState {
  scriptId: string
  currentNodeId: string | null
  variables: Record<string, string>
  startedAt: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function interpolate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{([\w_]+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`)
}

function findStartNode(flowData: FlowData): FlowNode | null {
  const targetIds = new Set(flowData.edges.map((e) => e.target))
  return flowData.nodes.find((n) => !targetIds.has(n.id)) ?? null
}

function getNextNode(flowData: FlowData, nodeId: string, handle?: string): FlowNode | null {
  const edge = flowData.edges.find(
    (e) => e.source === nodeId && (!handle || e.sourceHandle === handle || !e.sourceHandle)
  )
  if (!edge) return null
  return flowData.nodes.find((n) => n.id === edge.target) ?? null
}

function evaluateCondition(
  variable: string,
  operator: string,
  value: string,
  vars: Record<string, string>
): boolean {
  const varName = variable.replace(/^\{\{|\}\}$/g, '')
  const actual = vars[varName] ?? ''
  switch (operator) {
    case 'equals':      return actual.toLowerCase() === value.toLowerCase()
    case 'not_equals':  return actual.toLowerCase() !== value.toLowerCase()
    case 'contains':    return actual.toLowerCase().includes(value.toLowerCase())
    case 'not_contains':return !actual.toLowerCase().includes(value.toLowerCase())
    case 'starts_with': return actual.toLowerCase().startsWith(value.toLowerCase())
    case 'is_empty':    return !actual.trim()
    case 'is_not_empty':return !!actual.trim()
    case 'greater_than':return parseFloat(actual) > parseFloat(value)
    case 'less_than':   return parseFloat(actual) < parseFloat(value)
    default:            return false
  }
}

// ─── Node handlers ────────────────────────────────────────────────────────────

function handleMessageNode(node: FlowNode, context: ScriptContext, flowData: FlowData): ScriptStepResult {
  const text = interpolate((node.data.message as string) ?? '', context.variables)
  const next = getNextNode(flowData, node.id)
  return {
    response: text,
    nextNodeId: next?.id ?? null,
    capturedVariables: {},
    isComplete: !next,
    requiresUserInput: false,
    quickReplies: [],
  }
}

function handleQuestionNode(
  node: FlowNode,
  context: ScriptContext,
  userMessage: string,
  flowData: FlowData,
  isFirstVisit: boolean
): ScriptStepResult {
  if (isFirstVisit) {
    const question = interpolate((node.data.question as string) ?? '', context.variables)
    const choices = (node.data.choices as string[]) ?? []
    return {
      response: question,
      nextNodeId: node.id,
      capturedVariables: {},
      isComplete: false,
      requiresUserInput: true,
      quickReplies: choices,
    }
  }

  const varName = (node.data.variable_name as string) || 'answer'
  const next = getNextNode(flowData, node.id)
  return {
    response: null,
    nextNodeId: next?.id ?? null,
    capturedVariables: { [varName]: userMessage },
    isComplete: !next,
    requiresUserInput: false,
    quickReplies: [],
  }
}

function handleConditionNode(node: FlowNode, context: ScriptContext, flowData: FlowData): ScriptStepResult {
  const variable = (node.data.variable as string) ?? ''
  const operator = (node.data.operator as string) ?? 'equals'
  const value = (node.data.value as string) ?? ''
  const result = evaluateCondition(variable, operator, value, context.variables)
  const next = getNextNode(flowData, node.id, result ? 'true' : 'false')
  return {
    response: null,
    nextNodeId: next?.id ?? null,
    capturedVariables: {},
    isComplete: !next,
    requiresUserInput: false,
    quickReplies: [],
  }
}

async function handleAIResponseNode(node: FlowNode, context: ScriptContext, flowData: FlowData): Promise<ScriptStepResult> {
  const instructions = interpolate((node.data.instructions as string) ?? '', context.variables)
  const allowFallback = (node.data.allow_fallback as boolean) ?? true

  const anthropic = new Anthropic()
  const historyMessages = context.conversationHistory
    .filter((h) => h.role === 'user' || h.role === 'assistant')
    .slice(-6)
    .map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content }))

  const systemParts = [
    instructions ? `Instructions for this step: ${instructions}` : '',
    allowFallback ? 'If you cannot answer from context, politely say so.' : '',
  ].filter(Boolean)

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: systemParts.join('\n') || 'You are a helpful assistant.',
      messages: historyMessages.length > 0 ? historyMessages : [{ role: 'user', content: 'Hello' }],
    })
    const text = msg.content[0]?.type === 'text' ? msg.content[0].text : 'How can I help you?'
    const next = getNextNode(flowData, node.id)
    return { response: text, nextNodeId: next?.id ?? null, capturedVariables: {}, isComplete: !next, requiresUserInput: false, quickReplies: [] }
  } catch {
    const next = getNextNode(flowData, node.id)
    return { response: 'I apologize, I encountered an issue. How else can I help?', nextNodeId: next?.id ?? null, capturedVariables: {}, isComplete: !next, requiresUserInput: false, quickReplies: [] }
  }
}

async function handleAPICallNode(node: FlowNode, context: ScriptContext, flowData: FlowData): Promise<ScriptStepResult> {
  const url = interpolate((node.data.url as string) ?? '', context.variables)
  const method = (node.data.method as string) ?? 'GET'
  const headers = ((node.data.headers as Array<{ key: string; value: string }>) ?? [])
    .reduce<Record<string, string>>((acc, h) => { if (h.key) acc[h.key] = interpolate(h.value, context.variables); return acc }, {})
  const body = method !== 'GET' ? interpolate((node.data.body as string) ?? '', context.variables) : undefined
  const saveAs = (node.data.save_as as string) ?? 'api_response'
  const captured: Record<string, string> = {}
  try {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body || undefined })
    const data: unknown = await res.json()
    captured[saveAs] = typeof data === 'string' ? data : JSON.stringify(data)
  } catch {
    captured[saveAs] = 'error'
  }
  const next = getNextNode(flowData, node.id)
  return { response: null, nextNodeId: next?.id ?? null, capturedVariables: captured, isComplete: !next, requiresUserInput: false, quickReplies: [] }
}

function handleLeadCaptureNode(
  node: FlowNode,
  context: ScriptContext,
  userMessage: string,
  flowData: FlowData,
  isFirstVisit: boolean
): ScriptStepResult {
  const fields = (node.data.capture_fields as string[]) ?? ['name', 'phone']
  const customLabel = (node.data.custom_label as string) ?? 'Additional info'
  const fieldLabels: Record<string, string> = { name: 'your full name', phone: 'your phone number', email: 'your email address', custom: customLabel }

  const uncaptured = fields.find((f) => {
    const key = f === 'custom' ? customLabel.toLowerCase().replace(/\s+/g, '_') : f
    return !context.variables[key]
  })

  if (isFirstVisit && uncaptured) {
    return { response: `Please share ${fieldLabels[uncaptured] ?? uncaptured}:`, nextNodeId: node.id, capturedVariables: {}, isComplete: false, requiresUserInput: true, quickReplies: [] }
  }

  if (!isFirstVisit && uncaptured) {
    const key = uncaptured === 'custom' ? customLabel.toLowerCase().replace(/\s+/g, '_') : uncaptured
    const captured = { [key]: userMessage }
    const nextIdx = fields.indexOf(uncaptured) + 1
    const remaining = fields.slice(nextIdx).filter((f) => {
      const k = f === 'custom' ? customLabel.toLowerCase().replace(/\s+/g, '_') : f
      return !context.variables[k]
    })
    if (remaining.length > 0) {
      return { response: `Thank you! Now please share ${fieldLabels[remaining[0]] ?? remaining[0]}:`, nextNodeId: node.id, capturedVariables: captured, isComplete: false, requiresUserInput: true, quickReplies: [] }
    }
    const next = getNextNode(flowData, node.id)
    return { response: null, nextNodeId: next?.id ?? null, capturedVariables: captured, isComplete: !next, requiresUserInput: false, quickReplies: [] }
  }

  const next = getNextNode(flowData, node.id)
  return { response: null, nextNodeId: next?.id ?? null, capturedVariables: {}, isComplete: !next, requiresUserInput: false, quickReplies: [] }
}

// ─── Main executor ────────────────────────────────────────────────────────────

export async function executeScriptStep(
  flowData: FlowData,
  context: ScriptContext,
  userMessage: string
): Promise<ScriptStepResult> {
  if (!context.currentNodeId) {
    const startNode = findStartNode(flowData)
    if (!startNode) return { response: null, nextNodeId: null, capturedVariables: {}, isComplete: true, requiresUserInput: false, quickReplies: [] }
    context.currentNodeId = startNode.id
  }

  const node = flowData.nodes.find((n) => n.id === context.currentNodeId)
  if (!node) return { response: null, nextNodeId: null, capturedVariables: {}, isComplete: true, requiresUserInput: false, quickReplies: [] }

  const isFirstVisit = !userMessage.trim()

  switch (node.type) {
    case 'message':
      return handleMessageNode(node, context, flowData)
    case 'question':
      return handleQuestionNode(node, context, userMessage, flowData, isFirstVisit)
    case 'condition':
      return handleConditionNode(node, context, flowData)
    case 'ai_response':
      return handleAIResponseNode(node, context, flowData)
    case 'api_call':
      return handleAPICallNode(node, context, flowData)
    case 'booking': {
      const next = getNextNode(flowData, node.id)
      return { response: null, nextNodeId: next?.id ?? null, capturedVariables: {}, isComplete: !next, requiresUserInput: false, quickReplies: [], triggerBooking: true }
    }
    case 'lead_capture':
      return handleLeadCaptureNode(node, context, userMessage, flowData, isFirstVisit)
    case 'delay': {
      const next = getNextNode(flowData, node.id)
      return { response: null, nextNodeId: next?.id ?? null, capturedVariables: {}, isComplete: !next, requiresUserInput: false, quickReplies: [] }
    }
    case 'handoff': {
      const msg = interpolate((node.data.message as string) ?? 'Connecting you to a live agent…', context.variables)
      return { response: msg, nextNodeId: null, capturedVariables: {}, isComplete: true, requiresUserInput: false, quickReplies: [], handoffRequired: true }
    }
    default:
      return { response: null, nextNodeId: null, capturedVariables: {}, isComplete: true, requiresUserInput: false, quickReplies: [] }
  }
}

// ─── Legacy shim (used by step-4-scripts) ────────────────────────────────────

export interface ScriptExecutionResult {
  response: string
  scriptId: string
}

export async function executeScript(
  script: { id: string; flow_data: FlowData },
  context: PipelineContext
): Promise<ScriptExecutionResult | null> {
  const metadata = context as unknown as Record<string, unknown>
  const state = metadata.scriptState as ScriptState | undefined

  const scriptContext: ScriptContext = {
    currentNodeId: state?.scriptId === script.id ? (state?.currentNodeId ?? null) : null,
    variables: state?.scriptId === script.id ? (state?.variables ?? {}) : {},
    conversationHistory: context.history.map((h) => ({ role: h.role, content: h.content })),
    botId: context.botId,
    language: context.detectedLanguage ?? context.language ?? 'en',
  }

  const result = await executeScriptStep(script.flow_data, scriptContext, context.message)
  if (!result.response) return null
  return { response: result.response, scriptId: script.id }
}
