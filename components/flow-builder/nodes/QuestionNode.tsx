'use client'

import { type NodeProps, useReactFlow } from '@xyflow/react'
import { HelpCircle, Plus, X } from 'lucide-react'
import { BaseNode } from './BaseNode'

const COLOR = '#3b82f6'

export function QuestionNode({ id, data, selected }: NodeProps) {
  const { updateNodeData } = useReactFlow()
  const question = (data.question as string) ?? ''
  const variableName = (data.variable_name as string) ?? ''
  const inputType = (data.input_type as string) ?? 'text'
  const choices = (data.choices as string[]) ?? []

  function addChoice() {
    updateNodeData(id, { choices: [...choices, ''] })
  }

  function updateChoice(idx: number, val: string) {
    const next = [...choices]
    next[idx] = val
    updateNodeData(id, { choices: next })
  }

  function removeChoice(idx: number) {
    updateNodeData(id, { choices: choices.filter((_, i) => i !== idx) })
  }

  return (
    <BaseNode id={id} selected={selected} borderColor={COLOR} icon={<HelpCircle size={14} />} label="Question">
      <div className="space-y-2">
        <textarea
          className="w-full text-xs rounded px-2 py-1.5 resize-none nodrag"
          rows={2}
          placeholder="Question text…"
          value={question}
          onChange={(e) => updateNodeData(id, { question: e.target.value })}
          style={{ background: 'var(--bb-surface-3)', border: '1px solid var(--bb-border)', color: 'var(--bb-text-1)', outline: 'none' }}
        />
        <div className="flex gap-2">
          <input
            className="flex-1 text-xs rounded px-2 py-1 nodrag"
            placeholder="variable_name"
            value={variableName}
            onChange={(e) => updateNodeData(id, { variable_name: e.target.value })}
            style={{ background: 'var(--bb-surface-3)', border: '1px solid var(--bb-border)', color: 'var(--bb-text-1)', outline: 'none' }}
          />
          <select
            className="text-xs rounded px-2 py-1 nodrag"
            value={inputType}
            onChange={(e) => updateNodeData(id, { input_type: e.target.value })}
            style={{ background: 'var(--bb-surface-3)', border: '1px solid var(--bb-border)', color: 'var(--bb-text-1)', outline: 'none' }}
          >
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="phone">Phone</option>
            <option value="email">Email</option>
            <option value="choice">Choice</option>
          </select>
        </div>

        {inputType === 'choice' && (
          <div className="space-y-1">
            {choices.map((c, i) => (
              <div key={i} className="flex gap-1 items-center">
                <input
                  className="flex-1 text-xs rounded px-2 py-1 nodrag"
                  placeholder={`Option ${i + 1}`}
                  value={c}
                  onChange={(e) => updateChoice(i, e.target.value)}
                  style={{ background: 'var(--bb-surface-3)', border: '1px solid var(--bb-border)', color: 'var(--bb-text-1)', outline: 'none' }}
                />
                <button onClick={() => removeChoice(i)} className="nodrag p-1" style={{ color: 'var(--bb-text-3)' }}>
                  <X size={12} />
                </button>
              </div>
            ))}
            <button
              onClick={addChoice}
              className="nodrag flex items-center gap-1 text-xs px-2 py-1 rounded"
              style={{ color: COLOR, background: COLOR + '15' }}
            >
              <Plus size={11} /> Add option
            </button>
          </div>
        )}
      </div>
    </BaseNode>
  )
}
