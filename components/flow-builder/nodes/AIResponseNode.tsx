'use client'

import { type NodeProps, useReactFlow } from '@xyflow/react'
import { Bot } from 'lucide-react'
import { BaseNode } from './BaseNode'

const COLOR = '#6366f1'

export function AIResponseNode({ id, data, selected }: NodeProps) {
  const { updateNodeData } = useReactFlow()
  const instructions = (data.instructions as string) ?? ''
  const allowFallback = (data.allow_fallback as boolean) ?? true

  return (
    <BaseNode id={id} selected={selected} borderColor={COLOR} icon={<Bot size={14} />} label="AI Response">
      <div className="space-y-2">
        <textarea
          className="w-full text-xs rounded px-2 py-1.5 resize-none nodrag"
          rows={3}
          placeholder="Extra instructions for AI at this step…"
          value={instructions}
          onChange={(e) => updateNodeData(id, { instructions: e.target.value })}
          style={{ background: 'var(--bb-surface-3)', border: '1px solid var(--bb-border)', color: 'var(--bb-text-1)', outline: 'none' }}
        />
        <label className="flex items-center gap-2 cursor-pointer nodrag">
          <input
            type="checkbox"
            checked={allowFallback}
            onChange={(e) => updateNodeData(id, { allow_fallback: e.target.checked })}
            className="nodrag"
            style={{ accentColor: COLOR }}
          />
          <span className="text-xs" style={{ color: 'var(--bb-text-2)' }}>Allow fallback if no KB match</span>
        </label>
      </div>
    </BaseNode>
  )
}
