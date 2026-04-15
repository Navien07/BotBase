'use client'

import { useState } from 'react'
import { MessageSquare, HelpCircle, GitBranch, Bot, Globe, CalendarCheck, UserCheck, Timer, PhoneForwarded, Stethoscope, Shield, Home, UtensilsCrossed, ShoppingBag, BookOpen } from 'lucide-react'
import type { FlowData } from '@/types/database'
import { FlowGuideModal } from './FlowGuideModal'

interface NodeTypeItem {
  type: string
  label: string
  icon: React.ReactNode
  color: string
}

const NODE_TYPES: NodeTypeItem[] = [
  { type: 'message',      label: 'Message',      icon: <MessageSquare size={14} />,   color: '#f97316' },
  { type: 'question',     label: 'Question',     icon: <HelpCircle size={14} />,      color: '#3b82f6' },
  { type: 'condition',    label: 'Condition',    icon: <GitBranch size={14} />,       color: '#eab308' },
  { type: 'ai_response',  label: 'AI Response',  icon: <Bot size={14} />,             color: '#6366f1' },
  { type: 'api_call',     label: 'API Call',     icon: <Globe size={14} />,           color: '#22c55e' },
  { type: 'booking',      label: 'Booking',      icon: <CalendarCheck size={14} />,   color: '#14b8a6' },
  { type: 'lead_capture', label: 'Lead Capture', icon: <UserCheck size={14} />,       color: '#ec4899' },
  { type: 'delay',        label: 'Delay',        icon: <Timer size={14} />,           color: '#6b7280' },
  { type: 'handoff',      label: 'Handoff',      icon: <PhoneForwarded size={14} />, color: '#ef4444' },
]

interface Template {
  id: string
  label: string
  icon: React.ReactNode
  data: FlowData
}

const TEMPLATES: Template[] = [
  {
    id: 'clinic',
    label: 'Clinic Intake',
    icon: <Stethoscope size={14} />,
    data: {
      nodes: [
        { id: 'n1', type: 'message', position: { x: 250, y: 50 }, data: { message: 'Hello! Welcome to {{bot_name}}. How can I help you today?' } },
        { id: 'n2', type: 'question', position: { x: 250, y: 200 }, data: { question: 'Which service do you need?', variable_name: 'service', input_type: 'choice', choices: ['Consultation', 'Health Screening', 'Follow-up', 'Other'] } },
        { id: 'n3', type: 'condition', position: { x: 250, y: 380 }, data: { variable: '{{service}}', operator: 'equals', value: 'Other' } },
        { id: 'n4', type: 'ai_response', position: { x: 480, y: 550 }, data: { instructions: 'Answer the patient query using the clinic knowledge base.' } },
        { id: 'n5', type: 'lead_capture', position: { x: 20, y: 550 }, data: { capture_fields: ['name', 'phone'] } },
        { id: 'n6', type: 'booking', position: { x: 20, y: 730 }, data: { service_id: null } },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
        { id: 'e3', source: 'n3', target: 'n4', sourceHandle: 'true' },
        { id: 'e4', source: 'n3', target: 'n5', sourceHandle: 'false' },
        { id: 'e5', source: 'n5', target: 'n6' },
      ],
    },
  },
  {
    id: 'insurance',
    label: 'Insurance Lead',
    icon: <Shield size={14} />,
    data: {
      nodes: [
        { id: 'n1', type: 'message', position: { x: 250, y: 50 }, data: { message: 'Hi! I\'m here to help you find the right insurance plan.' } },
        { id: 'n2', type: 'question', position: { x: 250, y: 200 }, data: { question: 'What are you looking for?', variable_name: 'plan_type', input_type: 'choice', choices: ['Life', 'Medical', 'Car', 'Travel', 'Property'] } },
        { id: 'n3', type: 'lead_capture', position: { x: 250, y: 380 }, data: { capture_fields: ['name', 'phone', 'email'] } },
        { id: 'n4', type: 'ai_response', position: { x: 250, y: 560 }, data: { instructions: 'Explain the {{plan_type}} insurance options available.' } },
        { id: 'n5', type: 'handoff', position: { x: 250, y: 740 }, data: { message: 'An agent will follow up with you shortly!', agent_note: 'Lead interested in {{plan_type}} insurance' } },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
        { id: 'e3', source: 'n3', target: 'n4' },
        { id: 'e4', source: 'n4', target: 'n5' },
      ],
    },
  },
  {
    id: 'property',
    label: 'Property Enquiry',
    icon: <Home size={14} />,
    data: {
      nodes: [
        { id: 'n1', type: 'message', position: { x: 250, y: 50 }, data: { message: 'Welcome! Let me help you find your dream property.' } },
        { id: 'n2', type: 'question', position: { x: 250, y: 200 }, data: { question: 'What type of property are you looking for?', variable_name: 'property_type', input_type: 'choice', choices: ['Condo', 'Landed', 'Commercial', 'Land'] } },
        { id: 'n3', type: 'question', position: { x: 250, y: 380 }, data: { question: 'What is your budget range?', variable_name: 'budget', input_type: 'text' } },
        { id: 'n4', type: 'lead_capture', position: { x: 250, y: 560 }, data: { capture_fields: ['name', 'phone'] } },
        { id: 'n5', type: 'booking', position: { x: 250, y: 740 }, data: { service_id: null } },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
        { id: 'e3', source: 'n3', target: 'n4' },
        { id: 'e4', source: 'n4', target: 'n5' },
      ],
    },
  },
  {
    id: 'fnb',
    label: 'F&B Reservation',
    icon: <UtensilsCrossed size={14} />,
    data: {
      nodes: [
        { id: 'n1', type: 'message', position: { x: 250, y: 50 }, data: { message: 'Welcome to {{bot_name}}! Would you like to make a reservation?' } },
        { id: 'n2', type: 'question', position: { x: 250, y: 200 }, data: { question: 'How many guests?', variable_name: 'party_size', input_type: 'number' } },
        { id: 'n3', type: 'lead_capture', position: { x: 250, y: 380 }, data: { capture_fields: ['name', 'phone'] } },
        { id: 'n4', type: 'booking', position: { x: 250, y: 560 }, data: { service_id: null } },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
        { id: 'e3', source: 'n3', target: 'n4' },
      ],
    },
  },
  {
    id: 'ecommerce',
    label: 'E-commerce',
    icon: <ShoppingBag size={14} />,
    data: {
      nodes: [
        { id: 'n1', type: 'message', position: { x: 250, y: 50 }, data: { message: 'Hi! What can I help you with today?' } },
        { id: 'n2', type: 'question', position: { x: 250, y: 200 }, data: { question: 'What are you looking for?', variable_name: 'intent', input_type: 'choice', choices: ['Browse products', 'Track order', 'Return/refund', 'Talk to support'] } },
        { id: 'n3', type: 'condition', position: { x: 250, y: 380 }, data: { variable: '{{intent}}', operator: 'equals', value: 'Talk to support' } },
        { id: 'n4', type: 'ai_response', position: { x: 20, y: 560 }, data: { instructions: 'Help the customer with: {{intent}}', allow_fallback: true } },
        { id: 'n5', type: 'handoff', position: { x: 480, y: 560 }, data: { message: 'Connecting you to our support team...', agent_note: 'Customer needs live support' } },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
        { id: 'e3', source: 'n3', target: 'n4', sourceHandle: 'false' },
        { id: 'e4', source: 'n3', target: 'n5', sourceHandle: 'true' },
      ],
    },
  },
]

interface NodePanelProps {
  onLoadTemplate: (data: FlowData) => void
}

export function NodePanel({ onLoadTemplate }: NodePanelProps) {
  const [showGuide, setShowGuide] = useState(false)

  function onDragStart(event: React.DragEvent, type: string) {
    event.dataTransfer.setData('application/reactflow-node-type', type)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <>
    <div
      className="flex flex-col h-full overflow-y-auto"
      style={{ background: 'var(--bb-surface)', borderRight: '1px solid var(--bb-border)' }}
    >
      {/* Node types */}
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--bb-text-3)' }}>
            Node Types
          </div>
          <button
            onClick={() => setShowGuide(true)}
            title="Open Flow Builder Guide"
            className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded"
            style={{ color: 'var(--bb-primary)', background: 'rgba(99,102,241,0.1)' }}
          >
            <BookOpen size={11} /> Guide
          </button>
        </div>
        <div className="space-y-1">
          {NODE_TYPES.map(({ type, label, icon, color }) => (
            <div
              key={type}
              draggable
              onDragStart={(e) => onDragStart(e, type)}
              className="flex items-center gap-2 px-2 py-2 rounded cursor-grab active:cursor-grabbing select-none transition-colors"
              style={{ borderLeft: `3px solid ${color}`, background: 'var(--bb-surface-2)' }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLDivElement).style.background = 'var(--bb-surface-3)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLDivElement).style.background = 'var(--bb-surface-2)'
              }}
            >
              <span style={{ color }}>{icon}</span>
              <span className="text-xs font-medium" style={{ color: 'var(--bb-text-2)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--bb-border)', margin: '0 12px' }} />

      {/* Templates */}
      <div className="p-3">
        <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--bb-text-3)' }}>
          Templates
        </div>
        <div className="space-y-1">
          {TEMPLATES.map(({ id, label, icon, data }) => (
            <button
              key={id}
              onClick={() => onLoadTemplate(data)}
              className="w-full flex items-center gap-2 px-2 py-2 rounded text-left transition-colors"
              style={{ background: 'var(--bb-surface-2)' }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--bb-surface-3)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--bb-surface-2)'
              }}
            >
              <span style={{ color: 'var(--bb-text-3)' }}>{icon}</span>
              <span className="text-xs" style={{ color: 'var(--bb-text-2)' }}>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
    {showGuide && <FlowGuideModal onClose={() => setShowGuide(false)} />}
    </>
  )
}
