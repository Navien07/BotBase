import type { FlowData } from '@/types/database'

export const fnbReservationTemplate: FlowData = {
  nodes: [
    { id: 'n1', type: 'message',  position: { x: 250, y: 50  }, data: { message: "Welcome to {{bot_name}}! 🍽️ We'd love to have you dine with us." } },
    { id: 'n2', type: 'question', position: { x: 250, y: 220 }, data: { question: 'What would you like to do?', variable_name: 'intent', input_type: 'choice', choices: ['Make a reservation', 'View menu', 'Ask a question', 'Check operating hours'] } },
    { id: 'n3', type: 'condition', position: { x: 250, y: 400 }, data: { variable: '{{intent}}', operator: 'equals', value: 'Make a reservation' } },
    { id: 'n4', type: 'question', position: { x: 0, y: 580 }, data: { question: 'How many guests will be dining?', variable_name: 'party_size', input_type: 'number' } },
    { id: 'n5', type: 'lead_capture', position: { x: 0, y: 760 }, data: { capture_fields: ['name', 'phone'] } },
    { id: 'n6', type: 'booking', position: { x: 0, y: 940 }, data: { service_id: null } },
    { id: 'n7', type: 'ai_response', position: { x: 500, y: 580 }, data: { instructions: 'Help the customer with: {{intent}}. Use the restaurant knowledge base for menu, hours, and other info.', allow_fallback: true } },
  ],
  edges: [
    { id: 'e1', source: 'n1', target: 'n2' },
    { id: 'e2', source: 'n2', target: 'n3' },
    { id: 'e3', source: 'n3', target: 'n4', sourceHandle: 'true' },
    { id: 'e4', source: 'n3', target: 'n7', sourceHandle: 'false' },
    { id: 'e5', source: 'n4', target: 'n5' },
    { id: 'e6', source: 'n5', target: 'n6' },
  ],
}
