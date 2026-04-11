'use client'

import { type NodeProps, useReactFlow } from '@xyflow/react'
import { Timer } from 'lucide-react'
import { BaseNode } from './BaseNode'

const COLOR = '#6b7280'

export function DelayNode({ id, data, selected }: NodeProps) {
  const { updateNodeData } = useReactFlow()
  const amount = (data.amount as number) ?? 1
  const unit = (data.unit as string) ?? 'minutes'

  const inputStyle = {
    background: 'var(--bb-surface-3)',
    border: '1px solid var(--bb-border)',
    color: 'var(--bb-text-1)',
    outline: 'none',
  }

  return (
    <BaseNode id={id} selected={selected} borderColor={COLOR} icon={<Timer size={14} />} label="Delay">
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          className="w-16 text-xs rounded px-2 py-1 nodrag"
          value={amount}
          onChange={(e) => updateNodeData(id, { amount: parseInt(e.target.value, 10) || 1 })}
          style={inputStyle}
        />
        <select
          className="flex-1 text-xs rounded px-2 py-1 nodrag"
          value={unit}
          onChange={(e) => updateNodeData(id, { unit: e.target.value })}
          style={inputStyle}
        >
          <option value="minutes">minutes</option>
          <option value="hours">hours</option>
          <option value="days">days</option>
        </select>
      </div>
      <div className="text-xs mt-1.5" style={{ color: 'var(--bb-text-3)' }}>
        Wait {amount} {unit} before next step
      </div>
    </BaseNode>
  )
}
