'use client'

import { type NodeProps, useReactFlow } from '@xyflow/react'
import { Globe, Plus, X } from 'lucide-react'
import { BaseNode } from './BaseNode'

const COLOR = '#22c55e'

interface Header { key: string; value: string }

export function APICallNode({ id, data, selected }: NodeProps) {
  const { updateNodeData } = useReactFlow()
  const url = (data.url as string) ?? ''
  const method = (data.method as string) ?? 'GET'
  const headers = (data.headers as Header[]) ?? []
  const body = (data.body as string) ?? ''
  const saveAs = (data.save_as as string) ?? ''

  function addHeader() {
    updateNodeData(id, { headers: [...headers, { key: '', value: '' }] })
  }

  function updateHeader(idx: number, field: 'key' | 'value', val: string) {
    const next = headers.map((h, i) => i === idx ? { ...h, [field]: val } : h)
    updateNodeData(id, { headers: next })
  }

  function removeHeader(idx: number) {
    updateNodeData(id, { headers: headers.filter((_, i) => i !== idx) })
  }

  const inputStyle = {
    background: 'var(--bb-surface-3)',
    border: '1px solid var(--bb-border)',
    color: 'var(--bb-text-1)',
    outline: 'none',
  }

  return (
    <BaseNode id={id} selected={selected} borderColor={COLOR} icon={<Globe size={14} />} label="API Call">
      <div className="space-y-2">
        <div className="flex gap-1">
          <select
            className="text-xs rounded px-1.5 py-1 nodrag"
            value={method}
            onChange={(e) => updateNodeData(id, { method: e.target.value })}
            style={inputStyle}
          >
            {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => <option key={m}>{m}</option>)}
          </select>
          <input
            className="flex-1 text-xs rounded px-2 py-1 nodrag"
            placeholder="https://api.example.com/endpoint"
            value={url}
            onChange={(e) => updateNodeData(id, { url: e.target.value })}
            style={inputStyle}
          />
        </div>

        <div className="space-y-1">
          <span className="text-xs" style={{ color: 'var(--bb-text-3)' }}>Headers</span>
          {headers.map((h, i) => (
            <div key={i} className="flex gap-1 items-center">
              <input
                className="flex-1 text-xs rounded px-2 py-0.5 nodrag"
                placeholder="key"
                value={h.key}
                onChange={(e) => updateHeader(i, 'key', e.target.value)}
                style={inputStyle}
              />
              <input
                className="flex-1 text-xs rounded px-2 py-0.5 nodrag"
                placeholder="value"
                value={h.value}
                onChange={(e) => updateHeader(i, 'value', e.target.value)}
                style={inputStyle}
              />
              <button onClick={() => removeHeader(i)} className="nodrag" style={{ color: 'var(--bb-text-3)' }}>
                <X size={11} />
              </button>
            </div>
          ))}
          <button
            onClick={addHeader}
            className="nodrag flex items-center gap-1 text-xs px-1.5 py-0.5 rounded"
            style={{ color: COLOR, background: COLOR + '15' }}
          >
            <Plus size={10} /> Header
          </button>
        </div>

        {method !== 'GET' && (
          <textarea
            className="w-full text-xs rounded px-2 py-1.5 resize-none nodrag"
            rows={2}
            placeholder='{"key": "value"}'
            value={body}
            onChange={(e) => updateNodeData(id, { body: e.target.value })}
            style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace' }}
          />
        )}

        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--bb-text-3)' }}>Save as</span>
          <input
            className="flex-1 text-xs rounded px-2 py-0.5 nodrag"
            placeholder="response_variable"
            value={saveAs}
            onChange={(e) => updateNodeData(id, { save_as: e.target.value })}
            style={inputStyle}
          />
        </div>
      </div>
    </BaseNode>
  )
}
