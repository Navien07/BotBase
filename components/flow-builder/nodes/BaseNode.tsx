'use client'

import { Handle, Position } from '@xyflow/react'
import type { ReactNode } from 'react'

interface BaseNodeProps {
  id: string
  selected: boolean
  borderColor: string
  icon: ReactNode
  label: string
  children: ReactNode
  hasInput?: boolean
  hasOutput?: boolean
  outputHandles?: Array<{ id: string; label: string; color: string; position: number }>
}

export function BaseNode({
  selected,
  borderColor,
  icon,
  label,
  children,
  hasInput = true,
  hasOutput = true,
  outputHandles,
}: BaseNodeProps) {
  return (
    <div
      style={{
        background: 'var(--bb-surface-2)',
        border: `1px solid ${selected ? borderColor : 'var(--bb-border)'}`,
        borderLeft: `3px solid ${borderColor}`,
        borderRadius: 'var(--bb-radius)',
        minWidth: 220,
        maxWidth: 280,
        boxShadow: selected ? `0 0 0 2px ${borderColor}22` : 'none',
        transition: 'box-shadow 0.15s',
      }}
    >
      {hasInput && (
        <Handle
          type="target"
          position={Position.Top}
          style={{ background: '#404040', border: '2px solid #606060', width: 10, height: 10 }}
        />
      )}

      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ borderBottom: '1px solid var(--bb-border)' }}
      >
        <span style={{ color: borderColor, flexShrink: 0 }}>{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--bb-text-3)' }}>
          {label}
        </span>
      </div>

      {/* Body */}
      <div className="px-3 py-2">{children}</div>

      {/* Single output handle */}
      {hasOutput && !outputHandles && (
        <Handle
          type="source"
          position={Position.Bottom}
          style={{ background: '#404040', border: '2px solid #606060', width: 10, height: 10 }}
        />
      )}

      {/* Multiple output handles (ConditionNode) */}
      {outputHandles?.map((h) => (
        <Handle
          key={h.id}
          type="source"
          position={Position.Bottom}
          id={h.id}
          style={{
            background: h.color,
            border: `2px solid ${h.color}`,
            width: 10,
            height: 10,
            left: `${h.position}%`,
            bottom: -5,
          }}
        >
          <div
            className="absolute text-xs font-medium px-1.5 py-0.5 rounded"
            style={{
              bottom: -22,
              left: '50%',
              transform: 'translateX(-50%)',
              background: h.color + '22',
              color: h.color,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}
          >
            {h.label}
          </div>
        </Handle>
      ))}
    </div>
  )
}
