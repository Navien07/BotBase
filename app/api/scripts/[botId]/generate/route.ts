import { createClient } from '@/lib/supabase/server'
import { anthropic } from '@/lib/anthropic'
import { z } from 'zod'

const BodySchema = z.object({
  description: z.string().min(10).max(2000),
  industry: z.string().max(100),
})

const SYSTEM_PROMPT = `You are a chatbot flow designer. Generate a valid ReactFlow JSON object for a conversational flow.

RULES:
- Output ONLY a raw JSON object with "nodes" and "edges" arrays. No markdown, no explanation.
- Nodes must have: id (string), type (string), position ({ x: number, y: number }), data (object)
- Edges must have: id, source, target, and optionally sourceHandle

AVAILABLE NODE TYPES and their data fields:
- message: { message: string } — shows a message to the user
- question: { question: string, variable_name: string, input_type: "text"|"number"|"phone"|"email"|"choice", choices?: string[] }
- condition: { variable: "{{variable_name}}", operator: "equals"|"not_equals"|"contains"|"is_empty"|"greater_than"|"less_than", value?: string } — TWO source handles: "true" and "false"
- ai_response: { instructions?: string, allow_fallback?: boolean } — let Claude answer from knowledge base
- booking: { service_id?: null } — trigger booking flow
- lead_capture: { capture_fields: string[] } — capture_fields can include: "name", "phone", "email", "custom"
- delay: { amount: number, unit: "minutes"|"hours"|"days" }
- handoff: { message?: string, agent_note?: string } — terminal node, no output

LAYOUT RULES:
- Start nodes near x:250, y:50
- Space nodes 180px apart vertically
- For condition branches: place true branch at x:50, false branch at x:450

EDGE RULES:
- condition edges must specify sourceHandle: "true" or "false"
- all other edges need only source and target

Generate a complete, realistic flow for the described use case.`

export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const { botId } = await params
  if (!botId) return Response.json({ error: 'Missing botId' }, { status: 400 })

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const body: unknown = await req.json()
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) return Response.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })

    const { description, industry } = parsed.data

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Industry: ${industry}\n\nFlow description:\n${description}`,
        },
      ],
    })

    const text = anthropic.getTextContent(message).trim()
    if (!text) {
      return Response.json({ error: 'Unexpected response from AI' }, { status: 422 })
    }

    // Strip markdown code fences if present
    const jsonStr = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

    let flowData: unknown
    try {
      flowData = JSON.parse(jsonStr)
    } catch {
      console.error('[generate] JSON parse failed:', jsonStr.slice(0, 200))
      return Response.json({ error: 'AI returned invalid JSON', raw: jsonStr.slice(0, 500) }, { status: 422 })
    }

    if (typeof flowData !== 'object' || flowData === null) {
      return Response.json({ error: 'AI returned non-object JSON' }, { status: 422 })
    }

    const fd = flowData as Record<string, unknown>
    if (!Array.isArray(fd.nodes) || !Array.isArray(fd.edges)) {
      return Response.json({ error: 'Generated JSON missing nodes or edges arrays' }, { status: 422 })
    }

    return Response.json({ flow_data: flowData })
  } catch (error) {
    console.error('[generate POST]', error)
    return Response.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}
