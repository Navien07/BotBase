'use client'

import { type NodeProps, useReactFlow } from '@xyflow/react'
import { CalendarCheck } from 'lucide-react'
import { BaseNode } from './BaseNode'

const COLOR = '#14b8a6'

export function BookingNode({ id, data, selected }: NodeProps) {
  const { updateNodeData } = useReactFlow()
  const serviceId = (data.service_id as string) ?? ''

  return (
    <BaseNode id={id} selected={selected} borderColor={COLOR} icon={<CalendarCheck size={14} />} label="Booking">
      <div className="space-y-2">
        <div
          className="text-xs px-2 py-1.5 rounded flex items-center gap-2"
          style={{ background: COLOR + '15', color: COLOR }}
        >
          <CalendarCheck size={12} />
          Trigger Booking Flow
        </div>
        <input
          className="w-full text-xs rounded px-2 py-1 nodrag"
          placeholder="Service ID (optional pre-select)"
          value={serviceId}
          onChange={(e) => updateNodeData(id, { service_id: e.target.value })}
          style={{ background: 'var(--bb-surface-3)', border: '1px solid var(--bb-border)', color: 'var(--bb-text-1)', outline: 'none' }}
        />
      </div>
    </BaseNode>
  )
}
