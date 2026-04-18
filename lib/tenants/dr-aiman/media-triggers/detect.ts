// DR. AIMAN TENANT PLUGIN — skeptical/confirmed intent classifier.
// Uses Haiku via the shared anthropic client (never new Anthropic() from SDK —
// Turbopack mangles class constructors even with serverExternalPackages).
// Returns null on any failure or "neither" result — never throws.

import { anthropic } from '@/lib/anthropic'
import type { TriggerValue } from './config'

const SYSTEM_PROMPT = `You are classifying a patient's attitude toward a medical treatment being discussed.
Given the patient's latest message and the clinic bot's reply, classify the patient as one of:

- "skeptical": patient expresses doubt, asks for proof, says "really?", "are these results real?",
   "does this actually work?", "show me evidence", or otherwise signals hesitation about the treatment.
- "confirmed": patient explicitly agrees to proceed, says "ok let's do it", "yes I want this",
   "how do I sign up?", "I'm in", "book me", or otherwise signals readiness to start.
- "neither": anything else — general enquiry, small talk, off-topic, or ambiguous.

Return JSON only, no explanation: {"label":"skeptical"|"confirmed"|"neither"}`

export async function detectTrigger(
  userMessage: string,
  assistantResponse: string
): Promise<TriggerValue | null> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 50,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Patient: ${userMessage}\n\nBot reply: ${assistantResponse}`,
        },
      ],
    })

    const raw = anthropic.getTextContent(response)
    const cleaned = raw.replace(/```json|```/g, '').trim()

    let parsed: unknown
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      console.error('[dr-aiman/detect] JSON parse failed, raw response:', raw)
      return null
    }

    if (parsed !== null && typeof parsed === 'object' && 'label' in parsed) {
      const label = (parsed as Record<string, unknown>).label
      if (label === 'skeptical' || label === 'confirmed') return label
    }

    return null
  } catch (err) {
    console.error('[dr-aiman/detect] classifier error:', err)
    return null
  }
}
