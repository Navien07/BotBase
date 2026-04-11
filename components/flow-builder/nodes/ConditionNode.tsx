'use client'

import { type NodeProps, useReactFlow } from '@xyflow/react'
import { GitBranch } from 'lucide-react'
import { BaseNode } from './BaseNode'

const COLOR = '#eab308'

const OPERATORS = ['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'is_empty', 'is_not_empty', 'greater_than', 'less_than']

const OUTPUT_HANDLES = [
  { id: 'true', label: 'True', color: '#22c55e', position: 30 },
  { id: 'false', label: 'False', color: '#ef4444', position: 70 },
]

export function ConditionNode({ id, data, selected }: NodeProps) {
  const { updateNodeData } = useReactFlow()
  const variable = (data.variable as string) ?? ''
  const operator = (data.operator as string) ?? 'equals'
  const value = (data.value as string) ?? ''

  const needsValue = !['is_empty', 'is_not_empty'].includes(operator)

  return (
    <BaseNode
      id={id}
      selected={selected}
      borderColor={COLOR}
      icon={<GitBranch size={14} />}
      label="Condition"
      hasOutput={false}
      outputHandles={OUTPUT_HANDLES}
    >
      <div className="space-y-2">
        <input
          className="w-full text-xs rounded px-2 py-1 nodrag"
          placeholder="{{variable}}"
          value={variable}
          onChange={(e) => updateNodeData(id, { variable: e.target.value })}
          style={{ background: 'var(--bb-surface-3)', border: '1px solid var(--bb-border)', color: 'var(--bb-text-1)', outline: 'none' }}
        />
        <select
          className="w-full text-xs rounded px-2 py-1 nodrag"
          value={operator}
          onChange={(e) => updateNodeData(id, { operator: e.target.value })}
          style={{ background: 'var(--bb-surface-3)', border: '1px solid var(--bb-border)', color: 'var(--bb-text-1)', outline: 'none' }}
        >
          {OPERATORS.map((op) => (
            <option key={op} value={op}>{op.replace(/_/g, ' ')}</option>
          ))}
        </select>
        {needsValue && (
          <input
            className="w-full text-xs rounded px-2 py-1 nodrag"
            placeholder="value"
            value={value}
            onChange={(e) => updateNodeData(id, { value: e.target.value })}
            style={{ background: 'var(--bb-surface-3)', border: '1px solid var(--bb-border)', color: 'var(--bb-text-1)', outline: 'none' }}
          />
        )}
        <div className="text-xs" style={{ color: 'var(--bb-text-3)', fontFamily: 'JetBrains Mono, monospace' }}>
          if {variable || '…'} {operator.replace(/_/g, ' ')} {needsValue ? (value || '…') : ''}
        </div>
        {/* Spacer for output labels */}
        <div style={{ height: 14 }} />
      </div>
    </BaseNode>
  )
}
