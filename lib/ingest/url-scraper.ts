// URL scraper using cheerio
// Strips nav/script/style noise, returns clean text up to 50k chars

import * as cheerio from 'cheerio'

const MAX_CHARS = 50_000
const SCRAPE_TIMEOUT_MS = 10_000

export interface ScrapeResult {
  title: string
  text: string
}

export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'BotBase-Scraper/1.0' },
    signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${res.status} ${res.statusText}`)
  }

  const html = await res.text()
  const $ = cheerio.load(html)

  // Remove noise elements before extracting text
  $('script, style, nav, footer, header, aside, noscript, iframe').remove()

  const title = $('title').text().trim()
  const text = $('body').text().replace(/\s+/g, ' ').trim()

  return {
    title,
    text: text.substring(0, MAX_CHARS),
  }
}
