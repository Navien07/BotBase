import type { PipelineContext, StepResult } from './types'

interface LiveApiSource {
  url: string
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: Record<string, unknown>
}

export async function step7LiveApi(ctx: PipelineContext): Promise<StepResult> {
  const featureFlags = ctx.bot.feature_flags as unknown as Record<string, unknown>
  const sources = featureFlags?.live_api_sources as LiveApiSource[] | undefined

  if (!sources || sources.length === 0) {
    return {
      step: 7, name: 'live_api',
      status: 'skip',
      durationMs: 0,
      data: {},
    }
  }

  const results: Record<string, unknown> = {}
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3000)

  try {
    await Promise.all(
      sources.map(async (source, idx) => {
        try {
          const res = await fetch(source.url, {
            method: source.method ?? 'GET',
            headers: source.headers,
            body: source.method === 'POST' ? JSON.stringify(source.body) : undefined,
            signal: controller.signal,
          })
          if (res.ok) {
            results[`source_${idx}`] = await res.json()
          }
        } catch (err) {
          console.error(`[step-7-live-api] source ${idx} error:`, err)
        }
      })
    )
  } finally {
    clearTimeout(timeout)
  }

  if (Object.keys(results).length > 0) {
    ctx.liveApiData = results
  }

  return {
    step: 7, name: 'live_api',
    status: 'pass',
    durationMs: 0,
    data: { sources_fetched: Object.keys(results).length, total_sources: sources.length },
  }
}
