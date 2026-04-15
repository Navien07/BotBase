'use client'

import { useState, useCallback } from 'react'
import { Play, Square, RotateCcw } from 'lucide-react'
import type { FlowData } from '@/types/database'

interface Message {
  role: 'bot' | 'user'
  content: string
  quickReplies?: string[]
  nodeId?: string
}

interface PreviewState {
  currentNodeId: string | null
  variables: Record<string, string>
  messages: Message[]
  step: number
  total: number
  done: boolean
  waitingForInput: boolean
  quickReplies: string[]
}

function findStartNode(flowData: FlowData): string | null {
  const targetIds = new Set(flowData.edges.map((e) => e.target))
  const start = flowData.nodes.find((n) => !targetIds.has(n.id))
  return start?.id ?? null
}

function getNextNodeId(flowData: FlowData, nodeId: string, handle?: string): string | null {
  const edge = flowData.edges.find((e) => e.source === nodeId && (!handle || e.sourceHandle === handle || !e.sourceHandle))
  return edge?.target ?? null
}

function interpolate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{([\w_]+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`)
}

function evaluateCondition(variable: string, operator: string, value: string, vars: Record<string, string>): boolean {
  const varName = variable.replace(/^\{\{|\}\}$/g, '')
  const actual = vars[varName] ?? ''
  switch (operator) {
    case 'equals': return actual.toLowerCase() === value.toLowerCase()
    case 'not_equals': return actual.toLowerCase() !== value.toLowerCase()
    case 'contains': return actual.toLowerCase().includes(value.toLowerCase())
    case 'not_contains': return !actual.toLowerCase().includes(value.toLowerCase())
    case 'starts_with': return actual.toLowerCase().startsWith(value.toLowerCase())
    case 'is_empty': return !actual
    case 'is_not_empty': return !!actual
    case 'greater_than': return parseFloat(actual) > parseFloat(value)
    case 'less_than': return parseFloat(actual) < parseFloat(value)
    default: return false
  }
}

interface FlowPreviewProps {
  flowData: FlowData
  onNodeSelect?: (nodeId: string | null) => void
}

export function FlowPreview({ flowData, onNodeSelect }: FlowPreviewProps) {
  const [state, setState] = useState<PreviewState | null>(null)
  const [userInput, setUserInput] = useState('')
  const [running, setRunning] = useState(false)

  const totalNodes = flowData.nodes.length

  const processNode = useCallback((nodeId: string, vars: Record<string, string>, messages: Message[], step: number, depth = 0): PreviewState => {
    if (depth > 50) return { currentNodeId: null, variables: vars, messages: [...messages, { role: 'bot', content: '[Flow error: too many steps — check for loops]' }], step, total: totalNodes, done: true, waitingForInput: false, quickReplies: [] }
    const node = flowData.nodes.find((n) => n.id === nodeId)
    if (!node) return { currentNodeId: null, variables: vars, messages, step, total: totalNodes, done: true, waitingForInput: false, quickReplies: [] }

    onNodeSelect?.(nodeId)

    if (node.type === 'message') {
      const text = interpolate((node.data.message as string) ?? '', vars)
      const nextId = getNextNodeId(flowData, nodeId)
      const newMessages: Message[] = [...messages, { role: 'bot', content: text, nodeId }]
      if (!nextId) return { currentNodeId: null, variables: vars, messages: newMessages, step: step + 1, total: totalNodes, done: true, waitingForInput: false, quickReplies: [] }
      return processNode(nextId, vars, newMessages, step + 1, depth + 1)
    }

    if (node.type === 'question') {
      const text = interpolate((node.data.question as string) ?? '', vars)
      const choices = (node.data.choices as string[]) ?? []
      return {
        currentNodeId: nodeId,
        variables: vars,
        messages: [...messages, { role: 'bot', content: text, quickReplies: choices, nodeId }],
        step: step + 1,
        total: totalNodes,
        done: false,
        waitingForInput: true,
        quickReplies: choices,
      }
    }

    if (node.type === 'condition') {
      const condVariable = (node.data.variable as string) ?? ''
      const operator = (node.data.operator as string) ?? 'equals'
      const condValue = (node.data.value as string) ?? ''
      const result = evaluateCondition(condVariable, operator, condValue, vars)
      const handle = result ? 'true' : 'false'
      const nextId = getNextNodeId(flowData, nodeId, handle)
      if (!nextId) return { currentNodeId: null, variables: vars, messages, step: step + 1, total: totalNodes, done: true, waitingForInput: false, quickReplies: [] }
      return processNode(nextId, vars, messages, step + 1, depth + 1)
    }

    if (node.type === 'ai_response') {
      const nextId = getNextNodeId(flowData, nodeId)
      const newMessages: Message[] = [...messages, { role: 'bot', content: '[AI Response — powered by Claude]', nodeId }]
      if (!nextId) return { currentNodeId: null, variables: vars, messages: newMessages, step: step + 1, total: totalNodes, done: true, waitingForInput: false, quickReplies: [] }
      return processNode(nextId, vars, newMessages, step + 1)
    }

    if (node.type === 'booking') {
      const nextId = getNextNodeId(flowData, nodeId)
      const newMessages: Message[] = [...messages, { role: 'bot', content: '[Booking Flow Triggered]', nodeId }]
      if (!nextId) return { currentNodeId: null, variables: vars, messages: newMessages, step: step + 1, total: totalNodes, done: true, waitingForInput: false, quickReplies: [] }
      return processNode(nextId, vars, newMessages, step + 1)
    }

    if (node.type === 'lead_capture') {
      const fields = (node.data.capture_fields as string[]) ?? []
      return {
        currentNodeId: nodeId,
        variables: vars,
        messages: [...messages, { role: 'bot', content: `Collecting: ${fields.join(', ')}`, nodeId }],
        step: step + 1,
        total: totalNodes,
        done: false,
        waitingForInput: true,
        quickReplies: [],
      }
    }

    if (node.type === 'delay') {
      const amount = (node.data.amount as number) ?? 1
      const unit = (node.data.unit as string) ?? 'minutes'
      const nextId = getNextNodeId(flowData, nodeId)
      const newMessages: Message[] = [...messages, { role: 'bot', content: `[Waiting ${amount} ${unit}…]`, nodeId }]
      if (!nextId) return { currentNodeId: null, variables: vars, messages: newMessages, step: step + 1, total: totalNodes, done: true, waitingForInput: false, quickReplies: [] }
      return processNode(nextId, vars, newMessages, step + 1)
    }

    if (node.type === 'handoff') {
      const msg = (node.data.message as string) ?? 'Transferring to a live agent…'
      return {
        currentNodeId: null,
        variables: vars,
        messages: [...messages, { role: 'bot', content: msg, nodeId }],
        step: step + 1,
        total: totalNodes,
        done: true,
        waitingForInput: false,
        quickReplies: [],
      }
    }

    return { currentNodeId: null, variables: vars, messages, step, total: totalNodes, done: true, waitingForInput: false, quickReplies: [] }
  }, [flowData, onNodeSelect, totalNodes])

  function start() {
    const startId = findStartNode(flowData)
    if (!startId) return
    setRunning(true)
    const newState = processNode(startId, {}, [], 0)
    setState(newState)
    if (newState.done) setRunning(false)
  }

  function reset() {
    setState(null)
    setRunning(false)
    setUserInput('')
    onNodeSelect?.(null)
  }

  function submitInput(input: string) {
    if (!state?.waitingForInput || !state.currentNodeId) return
    const node = flowData.nodes.find((n) => n.id === state.currentNodeId)
    if (!node) return

    const newMessages: Message[] = [...state.messages, { role: 'user', content: input }]
    let newVars = { ...state.variables }

    if (node.type === 'question') {
      const varName = (node.data.variable_name as string) ?? 'answer'
      newVars[varName] = input
    }

    const nextId = getNextNodeId(flowData, state.currentNodeId)
    if (!nextId) {
      setState({ ...state, messages: newMessages, done: true, waitingForInput: false, quickReplies: [] })
      setRunning(false)
      return
    }

    const newState = processNode(nextId, newVars, newMessages, state.step)
    setState(newState)
    setUserInput('')
    if (newState.done) setRunning(false)
  }

  const progress = state ? Math.round((state.step / Math.max(state.total, 1)) * 100) : 0

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'var(--bb-surface)', borderLeft: '1px solid var(--bb-border)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: '1px solid var(--bb-border)' }}
      >
        <span className="text-xs font-semibold" style={{ color: 'var(--bb-text-2)' }}>Preview</span>
        <div className="flex gap-1">
          {!running && !state && (
            <button
              onClick={start}
              disabled={flowData.nodes.length === 0}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded"
              style={{ background: 'var(--bb-primary)', color: '#fff' }}
            >
              <Play size={11} /> Play
            </button>
          )}
          {(running || state) && (
            <button
              onClick={reset}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded"
              style={{ background: 'var(--bb-surface-3)', color: 'var(--bb-text-2)' }}
            >
              <RotateCcw size={11} /> Reset
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">
        {!state && (
          <div className="text-center py-12" style={{ color: 'var(--bb-text-3)' }}>
            <Play size={24} className="mx-auto mb-2 opacity-40" />
            <div className="text-xs">Press Play to simulate</div>
          </div>
        )}

        {state?.messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className="text-xs px-3 py-2 rounded-xl max-w-[85%]"
              style={{
                background: msg.role === 'bot' ? 'var(--bb-surface-2)' : 'var(--bb-primary)',
                color: msg.role === 'bot' ? 'var(--bb-text-1)' : '#fff',
                borderBottomLeftRadius: msg.role === 'bot' ? 4 : undefined,
                borderBottomRightRadius: msg.role === 'user' ? 4 : undefined,
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Quick replies */}
        {state?.waitingForInput && state.quickReplies.length > 0 && (
          <div className="flex flex-wrap gap-1 justify-center mt-2">
            {state.quickReplies.map((qr, i) => (
              <button
                key={i}
                onClick={() => submitInput(qr)}
                className="text-xs px-3 py-1.5 rounded-full border transition-colors"
                style={{
                  borderColor: 'var(--bb-primary)',
                  color: 'var(--bb-primary)',
                  background: 'transparent',
                }}
              >
                {qr}
              </button>
            ))}
          </div>
        )}

        {state?.done && (
          <div className="text-center text-xs mt-2" style={{ color: 'var(--bb-success)' }}>
            Flow complete
          </div>
        )}
      </div>

      {/* Input */}
      {state?.waitingForInput && (
        <div className="px-3 py-2" style={{ borderTop: '1px solid var(--bb-border)' }}>
          <div className="flex gap-2">
            <input
              className="flex-1 text-xs rounded px-2 py-1.5"
              placeholder="Type a response…"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && userInput.trim() && submitInput(userInput.trim())}
              style={{ background: 'var(--bb-surface-3)', border: '1px solid var(--bb-border)', color: 'var(--bb-text-1)', outline: 'none' }}
              autoFocus
            />
            <button
              onClick={() => userInput.trim() && submitInput(userInput.trim())}
              className="text-xs px-2 py-1 rounded"
              style={{ background: 'var(--bb-primary)', color: '#fff' }}
            >
              Send
            </button>
          </div>
        </div>
      )}

      {/* Progress */}
      {state && (
        <div className="px-3 py-2" style={{ borderTop: '1px solid var(--bb-border)' }}>
          <div className="flex items-center justify-between text-xs mb-1" style={{ color: 'var(--bb-text-3)' }}>
            <span>Step {state.step} of {state.total}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--bb-surface-3)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, background: 'var(--bb-primary)' }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
