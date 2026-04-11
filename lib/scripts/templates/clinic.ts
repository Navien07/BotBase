import type { FlowData } from '@/types/database'

export const clinicIntakeTemplate: FlowData = {
  nodes: [
    { id: 'n1', type: 'message',  position: { x: 250, y: 50  }, data: { message: 'Hello! 👋 Welcome to {{bot_name}}. How can I help you today?' } },
    { id: 'n2', type: 'question', position: { x: 250, y: 220 }, data: { question: 'Which service do you need?', variable_name: 'service', input_type: 'choice', choices: ['Consultation', 'Health Screening', 'Follow-up', 'Other'] } },
    { id: 'n3', type: 'condition', position: { x: 250, y: 400 }, data: { variable: '{{service}}', operator: 'equals', value: 'Other' } },
    { id: 'n4', type: 'ai_response', position: { x: 500, y: 580 }, data: { instructions: 'Answer the patient query using the clinic knowledge base.', allow_fallback: true } },
    { id: 'n5', type: 'lead_capture', position: { x: 0, y: 580 }, data: { capture_fields: ['name', 'phone'] } },
    { id: 'n6', type: 'booking', position: { x: 0, y: 760 }, data: { service_id: null } },
    { id: 'n7', type: 'message',  position: { x: 0, y: 940  }, data: { message: 'Your appointment has been booked! We will confirm shortly. 🗓️' } },
  ],
  edges: [
    { id: 'e1', source: 'n1', target: 'n2' },
    { id: 'e2', source: 'n2', target: 'n3' },
    { id: 'e3', source: 'n3', target: 'n4', sourceHandle: 'true' },
    { id: 'e4', source: 'n3', target: 'n5', sourceHandle: 'false' },
    { id: 'e5', source: 'n5', target: 'n6' },
    { id: 'e6', source: 'n6', target: 'n7' },
  ],
}
