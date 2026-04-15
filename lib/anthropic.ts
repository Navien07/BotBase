// Anthropic API client via raw fetch
//
// DO NOT use `new Anthropic()` from @anthropic-ai/sdk anywhere in this codebase.
// Turbopack (Next.js 16 production) mangles class constructors even when the package
// is listed in serverExternalPackages. Raw fetch uses only Node.js built-ins.

const ANTHROPIC_BASE = 'https://api.anthropic.com/v1'
const ANTHROPIC_VERSION = '2023-06-01'

export interface MessageParam {
  role: 'user' | 'assistant'
  content: string | ContentBlock[]
}

export interface ContentBlock {
  type: string
  text?: string
  [key: string]: unknown
}

interface MessagesResponse {
  id: string
  type: string
  role: string
  content: ContentBlock[]
  model: string
  stop_reason: string | null
  usage: { input_tokens: number; output_tokens: number }
}

interface CreateMessageParams {
  model: string
  max_tokens: number
  messages: MessageParam[]
  system?: string
}

function headers() {
  return {
    'x-api-key': process.env.ANTHROPIC_API_KEY!,
    'anthropic-version': ANTHROPIC_VERSION,
    'content-type': 'application/json',
  }
}

async function create(params: CreateMessageParams): Promise<MessagesResponse> {
  const response = await fetch(`${ANTHROPIC_BASE}/messages`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Anthropic API error ${response.status}: ${errText}`)
  }

  return response.json() as Promise<MessagesResponse>
}

// Returns an async generator that yields text chunks from a streaming response.
// Usage: for await (const chunk of anthropic.messages.stream({...})) { ... }
async function* stream(params: CreateMessageParams): AsyncGenerator<string> {
  const response = await fetch(`${ANTHROPIC_BASE}/messages`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ ...params, stream: true }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Anthropic API error ${response.status}: ${errText}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') continue
        try {
          const event = JSON.parse(data) as {
            type: string
            delta?: { type: string; text?: string }
          }
          if (
            event.type === 'content_block_delta' &&
            event.delta?.type === 'text_delta' &&
            event.delta.text
          ) {
            yield event.delta.text
          }
        } catch {
          // skip malformed SSE lines
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

function getTextContent(response: MessagesResponse): string {
  const block = response.content.find((b) => b.type === 'text')
  return block?.text ?? ''
}

export const anthropic = {
  messages: { create, stream },
  getTextContent,
}
