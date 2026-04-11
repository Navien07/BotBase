import type { FlowData } from '@/types/database'

export const ecommerceTemplate: FlowData = {
  nodes: [
    { id: 'n1', type: 'message',  position: { x: 250, y: 50  }, data: { message: "Hi! 👋 Welcome to {{bot_name}}. How can I help you today?" } },
    { id: 'n2', type: 'question', position: { x: 250, y: 220 }, data: { question: 'What are you looking for?', variable_name: 'intent', input_type: 'choice', choices: ['Browse products', 'Track my order', 'Return / Refund', 'Promotions', 'Talk to support'] } },
    { id: 'n3', type: 'condition', position: { x: 250, y: 400 }, data: { variable: '{{intent}}', operator: 'equals', value: 'Talk to support' } },
    { id: 'n4', type: 'condition', position: { x: 0, y: 580 }, data: { variable: '{{intent}}', operator: 'equals', value: 'Track my order' } },
    { id: 'n5', type: 'question', position: { x: 0, y: 760 }, data: { question: 'Please provide your order number:', variable_name: 'order_id', input_type: 'text' } },
    { id: 'n6', type: 'api_call', position: { x: 0, y: 940 }, data: { url: 'https://api.example.com/orders/{{order_id}}', method: 'GET', save_as: 'order_status' } },
    { id: 'n7', type: 'message',  position: { x: 0, y: 1120 }, data: { message: 'Your order status: {{order_status}}' } },
    { id: 'n8', type: 'ai_response', position: { x: 250, y: 760 }, data: { instructions: 'Help the customer with: {{intent}}. Use the product knowledge base.', allow_fallback: true } },
    { id: 'n9', type: 'lead_capture', position: { x: 500, y: 580 }, data: { capture_fields: ['name', 'phone'] } },
    { id: 'n10', type: 'handoff', position: { x: 500, y: 760 }, data: { message: 'Our support team will be with you shortly!', agent_note: 'Customer {{name}} needs live support for: {{intent}}' } },
  ],
  edges: [
    { id: 'e1', source: 'n1', target: 'n2' },
    { id: 'e2', source: 'n2', target: 'n3' },
    { id: 'e3', source: 'n3', target: 'n9', sourceHandle: 'true' },
    { id: 'e4', source: 'n3', target: 'n4', sourceHandle: 'false' },
    { id: 'e5', source: 'n4', target: 'n5', sourceHandle: 'true' },
    { id: 'e6', source: 'n4', target: 'n8', sourceHandle: 'false' },
    { id: 'e7', source: 'n5', target: 'n6' },
    { id: 'e8', source: 'n6', target: 'n7' },
    { id: 'e9', source: 'n9', target: 'n10' },
  ],
}
