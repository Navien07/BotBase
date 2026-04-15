'use client'

import { X, MessageSquare, HelpCircle, GitBranch, Bot, Globe, CalendarCheck, UserCheck, Timer, PhoneForwarded, Zap, ArrowRight } from 'lucide-react'

interface Props {
  onClose: () => void
}

const NODES = [
  {
    icon: <MessageSquare size={16} />,
    color: '#f97316',
    name: 'Message',
    summary: 'Send a text message to the user.',
    details: 'Displays a message bubble in the chat. Use {{variable_name}} to insert previously collected values dynamically.',
    example: 'Hi {{name}}, thanks for reaching out!',
    tip: 'Works best as the first node to greet users.',
  },
  {
    icon: <HelpCircle size={16} />,
    color: '#3b82f6',
    name: 'Question',
    summary: 'Ask the user a question and save their answer.',
    details: 'Pauses the flow and waits for user input. Choose from Text, Number, Phone, Email, or Choice (multiple choice buttons).',
    example: 'What service do you need? → saved as {{service}}',
    tip: 'Always set a variable name — it\'s used by Condition nodes and Message nodes downstream.',
  },
  {
    icon: <GitBranch size={16} />,
    color: '#eab308',
    name: 'Condition',
    summary: 'Branch the flow based on a variable\'s value.',
    details: 'Evaluates a variable against a rule (equals, contains, greater than, etc.) and routes to the True or False path. Connect two different nodes to each handle.',
    example: '{{service}} equals "Other" → True: AI Response, False: Booking',
    tip: 'Always connect both the True (green) and False (red) handles, otherwise the flow ends silently.',
  },
  {
    icon: <Bot size={16} />,
    color: '#6366f1',
    name: 'AI Response',
    summary: 'Generate a smart reply using Claude AI.',
    details: 'Queries your bot\'s knowledge base and uses Claude to craft a contextual response. Add custom instructions to focus the AI on a specific task.',
    example: 'Instructions: Answer the customer\'s question about {{topic}} using the product FAQ.',
    tip: 'Place after a Question node so the AI knows what to respond to.',
  },
  {
    icon: <Globe size={16} />,
    color: '#22c55e',
    name: 'API Call',
    summary: 'Call an external HTTP endpoint.',
    details: 'Makes a GET or POST request to any URL. You can pass variables in the request body and store the response in a variable for use downstream.',
    example: 'POST https://api.example.com/check-slot with {"date": "{{date}}"}',
    tip: 'Use to check availability, look up orders, or trigger webhooks in real time.',
  },
  {
    icon: <CalendarCheck size={16} />,
    color: '#14b8a6',
    name: 'Booking',
    summary: 'Trigger the built-in booking flow.',
    details: 'Launches the appointment / table / property viewing booking machine. Optionally pre-select a service. The bot handles date, time, and confirmation automatically.',
    example: 'Trigger booking flow → Service: GenQi Wellness Consultation',
    tip: 'Booking must be enabled in bot settings and services must be configured under the Booking tab.',
  },
  {
    icon: <UserCheck size={16} />,
    color: '#ec4899',
    name: 'Lead Capture',
    summary: 'Collect contact information from the user.',
    details: 'Presents a structured form collecting Name, Phone, Email, and/or custom fields. Saved to the Contacts CRM automatically.',
    example: 'Capture: name, phone → Contact saved to CRM',
    tip: 'Put this before a Booking node so you know who is booking.',
  },
  {
    icon: <Timer size={16} />,
    color: '#6b7280',
    name: 'Delay',
    summary: 'Pause the flow for a set duration.',
    details: 'Waits for a configured number of seconds, minutes, or hours before continuing. Useful for follow-up messages or spacing out communications.',
    example: 'Wait 2 hours → then send reminder message',
    tip: 'In the preview simulator, delays are shown as text and not actually waited.',
  },
  {
    icon: <PhoneForwarded size={16} />,
    color: '#ef4444',
    name: 'Handoff',
    summary: 'Transfer the chat to a live human agent.',
    details: 'Ends the automated flow and marks the conversation for agent takeover. Sends a farewell message to the user and an internal note to your team.',
    example: 'Message: "Connecting you to a specialist…" | Note: "Interested in premium plan"',
    tip: 'This is a terminal node — do not connect an output from it.',
  },
]

export function FlowGuideModal({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border overflow-hidden"
        style={{ background: 'var(--bb-surface)', borderColor: 'var(--bb-border)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--bb-border)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(99,102,241,0.15)' }}
            >
              <Zap size={16} style={{ color: 'var(--bb-primary)' }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--bb-text-1)' }}>
                Flow Builder Guide
              </h2>
              <p className="text-xs" style={{ color: 'var(--bb-text-3)' }}>
                How to build conversation flows and what each node does
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--bb-text-3)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* How it works */}
        <div
          className="px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--bb-border)', background: 'var(--bb-surface-2)' }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--bb-text-3)' }}>
            How it works
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              'Drag a node from the left panel onto the canvas',
              'Connect nodes by dragging from the bottom handle to the top handle of the next node',
              'Edit node content directly on the canvas',
              'Use the Preview panel to simulate the conversation',
              'Publish when ready to go live',
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: 'var(--bb-primary)', color: '#fff' }}
                >
                  {i + 1}
                </div>
                <span className="text-xs" style={{ color: 'var(--bb-text-2)' }}>{step}</span>
                {i < 4 && <ArrowRight size={12} style={{ color: 'var(--bb-text-3)', flexShrink: 0 }} />}
              </div>
            ))}
          </div>
        </div>

        {/* Node list */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--bb-text-3)' }}>
            Node Types
          </p>
          <div className="grid grid-cols-1 gap-3">
            {NODES.map((node) => (
              <div
                key={node.name}
                className="rounded-xl border p-4"
                style={{ background: 'var(--bb-surface-2)', borderColor: 'var(--bb-border)', borderLeft: `3px solid ${node.color}` }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: node.color + '20', color: node.color }}
                  >
                    {node.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold" style={{ color: 'var(--bb-text-1)' }}>{node.name}</span>
                      <span className="text-xs" style={{ color: 'var(--bb-text-3)' }}>—</span>
                      <span className="text-xs" style={{ color: 'var(--bb-text-2)' }}>{node.summary}</span>
                    </div>
                    <p className="text-xs mb-2" style={{ color: 'var(--bb-text-3)', lineHeight: 1.6 }}>
                      {node.details}
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <div
                        className="text-xs px-2 py-1 rounded-md font-mono"
                        style={{ background: 'var(--bb-surface-3)', color: 'var(--bb-text-2)' }}
                      >
                        e.g. {node.example}
                      </div>
                      <div
                        className="text-xs px-2 py-1 rounded-md"
                        style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--bb-primary)' }}
                      >
                        Tip: {node.tip}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
