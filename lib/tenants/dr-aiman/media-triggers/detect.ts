// DR. AIMAN TENANT PLUGIN — skeptical/confirmed intent classifier.
// Uses Haiku via the shared anthropic client (never new Anthropic() from SDK —
// Turbopack mangles class constructors even with serverExternalPackages).
// Returns null on any failure or "neither" result — never throws.

import { anthropic } from '@/lib/anthropic'
import type { TriggerValue } from './config'

const SYSTEM_PROMPT = `You are classifying a patient's attitude toward a medical treatment being discussed.
Given the patient's latest message and the clinic bot's reply, classify the patient as one of:

- "skeptical": patient expresses doubt, asks for proof, or signals hesitation. Examples (English): "really?", "are these results real?", "does this actually work?", "show me evidence". Examples (Malay): "betul ke ni?", "hasil ni real ke?", "ada bukti tak?", "yakin ke ni?".
- "confirmed": patient explicitly agrees to proceed or signals readiness. Examples (English): "ok let's do it", "yes I want this", "how do I sign up?", "I'm in", "book me". Examples (Malay): "ok saya nak try", "macam mana nak book?", "saya minat", "jom buat".
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

    let parsed: unknown
    // Attempt 1: direct parse of trimmed raw
    try {
      parsed = JSON.parse(raw.trim())
    } catch {
      // Attempt 2: extract first {...} substring (handles markdown fences and surrounding text)
      const match = raw.match(/\{[^}]+\}/)
      if (match) {
        console.warn('[dr-aiman/detect] JSON fence fallback, raw response:', raw)
        try {
          parsed = JSON.parse(match[0])
        } catch {
          console.error('[dr-aiman/detect] JSON parse failed after regex fallback, raw response:', raw)
          return null
        }
      } else {
        console.error('[dr-aiman/detect] no JSON object found, raw response:', raw)
        return null
      }
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
