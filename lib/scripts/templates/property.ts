import type { FlowData } from '@/types/database'

export const propertyEnquiryTemplate: FlowData = {
  nodes: [
    { id: 'n1', type: 'message',  position: { x: 250, y: 50  }, data: { message: "Welcome to {{bot_name}}! 🏠 Let me help you find your perfect property." } },
    { id: 'n2', type: 'question', position: { x: 250, y: 220 }, data: { question: 'What type of property are you looking for?', variable_name: 'property_type', input_type: 'choice', choices: ['Condominium', 'Landed House', 'Commercial', 'Industrial', 'Land'] } },
    { id: 'n3', type: 'question', position: { x: 250, y: 400 }, data: { question: 'Which area or state do you prefer?', variable_name: 'location', input_type: 'text' } },
    { id: 'n4', type: 'question', position: { x: 250, y: 580 }, data: { question: 'What is your budget range?', variable_name: 'budget', input_type: 'choice', choices: ['Below RM300k', 'RM300k–500k', 'RM500k–1M', 'Above RM1M'] } },
    { id: 'n5', type: 'lead_capture', position: { x: 250, y: 760 }, data: { capture_fields: ['name', 'phone'] } },
    { id: 'n6', type: 'ai_response', position: { x: 250, y: 940 }, data: { instructions: 'Suggest available {{property_type}} listings in {{location}} within {{budget}} budget from the knowledge base.', allow_fallback: true } },
    { id: 'n7', type: 'booking', position: { x: 250, y: 1120 }, data: { service_id: null } },
  ],
  edges: [
    { id: 'e1', source: 'n1', target: 'n2' },
    { id: 'e2', source: 'n2', target: 'n3' },
    { id: 'e3', source: 'n3', target: 'n4' },
    { id: 'e4', source: 'n4', target: 'n5' },
    { id: 'e5', source: 'n5', target: 'n6' },
    { id: 'e6', source: 'n6', target: 'n7' },
  ],
}
