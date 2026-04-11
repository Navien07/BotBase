'use client'

import { type NodeProps, useReactFlow } from '@xyflow/react'
import { PhoneForwarded } from 'lucide-react'
import { BaseNode } from './BaseNode'

const COLOR = '#ef4444'

export function HandoffNode({ id, data, selected }: NodeProps) {
  const { updateNodeData } = useReactFlow()
  const message = (data.message as string) ?? ''
  const agentNote = (data.agent_note as string) ?? ''

  const textareaStyle = {
    background: 'var(--bb-surface-3)',
    border: '1px solid var(--bb-border)',
    color: 'var(--bb-text-1)',
    outline: 'none',
  }

  return (
    <BaseNode id={id} selected={selected} borderColor={COLOR} icon={<PhoneForwarded size={14} />} label="Handoff" hasOutput={false}>
      <div className="space-y-2">
        <div className="text-xs px-2 py-1 rounded" style={{ background: COLOR + '15', color: COLOR }}>
          Terminal — transfers to live agent
        </div>
        <textarea
          className="w-full text-xs rounded px-2 py-1.5 resize-none nodrag"
          rows={2}
          placeholder="Message shown to user before handoff…"
          value={message}
          onChange={(e) => updateNodeData(id, { message: e.target.value })}
          style={textareaStyle}
        />
        <textarea
          className="w-full text-xs rounded px-2 py-1.5 resize-none nodrag"
          rows={2}
          placeholder="Note for agent (internal)…"
          value={agentNote}
          onChange={(e) => updateNodeData(id, { agent_note: e.target.value })}
          style={textareaStyle}
        />
      </div>
    </BaseNode>
  )
}
