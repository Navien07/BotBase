'use client'

import { type NodeProps, useReactFlow } from '@xyflow/react'
import { UserCheck } from 'lucide-react'
import { BaseNode } from './BaseNode'

const COLOR = '#ec4899'

const DEFAULT_FIELDS = [
  { name: 'name', label: 'Name' },
  { name: 'phone', label: 'Phone' },
  { name: 'email', label: 'Email' },
]

export function LeadCaptureNode({ id, data, selected }: NodeProps) {
  const { updateNodeData } = useReactFlow()
  const captureFields = (data.capture_fields as string[]) ?? ['name', 'phone']
  const customLabel = (data.custom_label as string) ?? ''

  function toggle(name: string) {
    const next = captureFields.includes(name)
      ? captureFields.filter((f) => f !== name)
      : [...captureFields, name]
    updateNodeData(id, { capture_fields: next })
  }

  const captureCustom = captureFields.includes('custom')

  return (
    <BaseNode id={id} selected={selected} borderColor={COLOR} icon={<UserCheck size={14} />} label="Lead Capture">
      <div className="space-y-1.5">
        {DEFAULT_FIELDS.map(({ name, label }) => (
          <label key={name} className="flex items-center gap-2 cursor-pointer nodrag">
            <input
              type="checkbox"
              checked={captureFields.includes(name)}
              onChange={() => toggle(name)}
              style={{ accentColor: COLOR }}
            />
            <span className="text-xs" style={{ color: 'var(--bb-text-2)' }}>{label}</span>
          </label>
        ))}
        <label className="flex items-center gap-2 cursor-pointer nodrag">
          <input
            type="checkbox"
            checked={captureCustom}
            onChange={() => toggle('custom')}
            style={{ accentColor: COLOR }}
          />
          <span className="text-xs" style={{ color: 'var(--bb-text-2)' }}>Custom field</span>
        </label>
        {captureCustom && (
          <input
            className="w-full text-xs rounded px-2 py-1 nodrag"
            placeholder="Custom field label"
            value={customLabel}
            onChange={(e) => updateNodeData(id, { custom_label: e.target.value })}
            style={{ background: 'var(--bb-surface-3)', border: '1px solid var(--bb-border)', color: 'var(--bb-text-1)', outline: 'none' }}
          />
        )}
      </div>
    </BaseNode>
  )
}
