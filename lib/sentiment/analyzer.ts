import Anthropic from '@anthropic-ai/sdk'
import type { Sentiment } from '@/types/database'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

interface SentimentResult {
  sentiment: Sentiment
  score: number
}

export async function analyzeSentiment(message: string): Promise<SentimentResult> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 30,
      system: 'Classify the sentiment. Return only JSON: {"sentiment":"positive"|"neutral"|"negative"|"frustrated","score":0.0-1.0}',
      messages: [{ role: 'user', content: message.slice(0, 500) }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const parsed = JSON.parse(text.trim()) as { sentiment: Sentiment; score: number }
    return {
      sentiment: parsed.sentiment ?? 'neutral',
      score: typeof parsed.score === 'number' ? parsed.score : 0.5,
    }
  } catch {
    return { sentiment: 'neutral', score: 0.5 }
  }
}
