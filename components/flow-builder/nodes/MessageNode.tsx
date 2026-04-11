'use client'

import { type NodeProps, useReactFlow } from '@xyflow/react'
import { MessageSquare } from 'lucide-react'
import { BaseNode } from './BaseNode'

const COLOR = '#f97316'

function highlightVariables(text: string) {
  const parts = text.split(/({{[\w_]+}})/)
  return parts.map((part, i) =>
    part.match(/^{{[\w_]+}}$/)
      ? <span key={i} style={{ color: 'var(--bb-primary)', fontWeight: 600 }}>{part}</span>
      : <span key={i}>{part}</span>
  )
}

export function MessageNode({ id, data, selected }: NodeProps) {
  const { updateNodeData } = useReactFlow()
  const message = (data.message as string) ?? ''

  return (
    <BaseNode id={id} selected={selected} borderColor={COLOR} icon={<MessageSquare size={14} />} label="Message">
      <textarea
        className="w-full text-xs rounded px-2 py-1.5 resize-none nodrag"
        rows={3}
        placeholder="Type your message… use {{variable}}"
        value={message}
        onChange={(e) => updateNodeData(id, { message: e.target.value })}
        style={{
          background: 'var(--bb-surface-3)',
          border: '1px solid var(--bb-border)',
          color: 'var(--bb-text-1)',
          outline: 'none',
        }}
      />
      {message && (
        <div className="text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--bb-text-2)' }}>
          {highlightVariables(message)}
        </div>
      )}
    </BaseNode>
  )
}
