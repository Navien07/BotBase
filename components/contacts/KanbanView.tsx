'use client'

import { useState } from 'react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core'
import { toast } from 'sonner'
import type { Contact, LeadStage } from '@/types/database'
import { formatDistanceToNow } from 'date-fns'

const STAGES: { id: LeadStage; label: string; color: string }[] = [
  { id: 'new', label: 'New', color: '#818cf8' },
  { id: 'engaged', label: 'Engaged', color: '#22d3ee' },
  { id: 'qualified', label: 'Qualified', color: '#22c55e' },
  { id: 'booked', label: 'Booked', color: '#f59e0b' },
  { id: 'converted', label: 'Converted', color: '#4ade80' },
  { id: 'churned', label: 'Churned', color: '#ef4444' },
]

const CHANNEL_ICON: Record<string, string> = {
  whatsapp: '📱', telegram: '✈️', web_widget: '🌐',
  instagram: '📷', facebook: '📘', api: '🔗', manual: '✏️', import: '📂',
}

function ContactCard({
  contact,
  onClick,
}: {
  contact: Contact
  onClick: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: contact.id,
    data: { contact },
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className="rounded-lg p-3 cursor-pointer select-none"
      style={{
        background: 'var(--bb-surface)',
        border: '1px solid var(--bb-border)',
        opacity: isDragging ? 0.4 : 1,
        transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--bb-text-1)' }}>
          {contact.name ?? contact.phone ?? contact.email ?? 'Unknown'}
        </p>
        <span className="text-base flex-shrink-0">{CHANNEL_ICON[contact.channel] ?? '💬'}</span>
      </div>
      {contact.phone && (
        <p className="text-xs truncate mb-1" style={{ color: 'var(--bb-text-3)' }}>{contact.phone}</p>
      )}
      <div className="flex items-center justify-between mt-2">
        <div className="h-1 w-16 rounded-full overflow-hidden" style={{ background: 'var(--bb-surface-3)' }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${contact.lead_score}%`, background: 'var(--bb-primary)' }}
          />
        </div>
        <span className="text-xs" style={{ color: 'var(--bb-text-3)' }}>
          {contact.last_message_at
            ? formatDistanceToNow(new Date(contact.last_message_at), { addSuffix: true })
            : '—'}
        </span>
      </div>
      {contact.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {contact.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ background: 'var(--bb-surface-3)', color: 'var(--bb-text-3)' }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function KanbanColumn({
  stage,
  contacts,
  onCardClick,
}: {
  stage: (typeof STAGES)[0]
  contacts: Contact[]
  onCardClick: (c: Contact) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })

  return (
    <div className="flex flex-col min-w-[220px] w-[220px]">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: stage.color }} />
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--bb-text-2)' }}>
            {stage.label}
          </span>
        </div>
        <span
          className="text-xs px-1.5 py-0.5 rounded-full"
          style={{ background: 'var(--bb-surface-3)', color: 'var(--bb-text-3)' }}
        >
          {contacts.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className="flex-1 space-y-2 min-h-[200px] rounded-lg p-2 transition-colors"
        style={{
          background: isOver ? 'rgba(99,102,241,0.05)' : 'var(--bb-surface-2)',
          border: isOver ? '1px dashed var(--bb-primary)' : '1px solid var(--bb-border)',
        }}
      >
        {contacts.map((c) => (
          <ContactCard key={c.id} contact={c} onClick={() => onCardClick(c)} />
        ))}
      </div>
    </div>
  )
}

interface Props {
  contacts: Contact[]
  botId: string
  onCardClick: (c: Contact) => void
  onContactUpdate: (updated: Contact) => void
}

export function KanbanView({ contacts, botId, onCardClick, onContactUpdate }: Props) {
  const [localContacts, setLocalContacts] = useState(contacts)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  // Sync when parent contacts change
  if (contacts !== localContacts && contacts.length !== localContacts.length) {
    setLocalContacts(contacts)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const contactId = active.id as string
    const newStage = over.id as LeadStage

    // Optimistic update
    const updated = localContacts.map((c) =>
      c.id === contactId ? { ...c, lead_stage: newStage } : c
    )
    setLocalContacts(updated)

    try {
      const res = await fetch(`/api/contacts/${botId}/${contactId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_stage: newStage }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      onContactUpdate(data.contact)
    } catch {
      // Revert
      setLocalContacts(contacts)
      toast.error('Failed to update stage')
    }
  }

  const byStage = (stage: LeadStage) => localContacts.filter((c) => c.lead_stage === stage)

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            contacts={byStage(stage.id)}
            onCardClick={onCardClick}
          />
        ))}
      </div>
    </DndContext>
  )
}
