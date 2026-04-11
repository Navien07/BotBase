import type { FlowData } from '@/types/database'

export const insuranceLeadTemplate: FlowData = {
  nodes: [
    { id: 'n1', type: 'message',  position: { x: 250, y: 50  }, data: { message: "Hi! I'm here to help you find the right insurance plan for your needs." } },
    { id: 'n2', type: 'question', position: { x: 250, y: 220 }, data: { question: 'What type of coverage are you looking for?', variable_name: 'plan_type', input_type: 'choice', choices: ['Life Insurance', 'Medical Insurance', 'Car Insurance', 'Travel Insurance', 'Property Insurance'] } },
    { id: 'n3', type: 'lead_capture', position: { x: 250, y: 400 }, data: { capture_fields: ['name', 'phone', 'email'] } },
    { id: 'n4', type: 'question', position: { x: 250, y: 580 }, data: { question: 'What is your approximate monthly budget (RM)?', variable_name: 'budget', input_type: 'number' } },
    { id: 'n5', type: 'ai_response', position: { x: 250, y: 760 }, data: { instructions: 'Explain available {{plan_type}} options within the customer budget of RM{{budget}}/month. Highlight key benefits.', allow_fallback: true } },
    { id: 'n6', type: 'handoff', position: { x: 250, y: 940 }, data: { message: 'Our insurance specialist will contact you within 24 hours to discuss your options.', agent_note: 'Lead interested in {{plan_type}}, budget RM{{budget}}/month. Contact: {{name}} — {{phone}}' } },
  ],
  edges: [
    { id: 'e1', source: 'n1', target: 'n2' },
    { id: 'e2', source: 'n2', target: 'n3' },
    { id: 'e3', source: 'n3', target: 'n4' },
    { id: 'e4', source: 'n4', target: 'n5' },
    { id: 'e5', source: 'n5', target: 'n6' },
  ],
}
