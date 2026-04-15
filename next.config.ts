import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

// Security headers with microphone allowed (for testing console)
const securityHeadersWithMic = securityHeaders.map(h =>
  h.key === 'Permissions-Policy'
    ? { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' }
    : h
)

const nextConfig: NextConfig = {
  serverExternalPackages: ['voyageai', 'pdf-parse', 'unpdf', 'pdf2json', 'mammoth', 'sharp', 'cheerio', '@anthropic-ai/sdk', 'gpt-tokenizer'],
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }],
  },
  async headers() {
    return [
      // Testing console — must come before the broad rule so it takes effect exclusively
      {
        source: '/dashboard/bots/:botId/testing',
        headers: [
          ...securityHeadersWithMic,
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
      {
        source: '/((?!chat|dashboard/bots).*)',
        headers: [
          ...securityHeaders,
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
      // dashboard routes (non-testing)
      {
        source: '/dashboard/:path((?!bots/[^/]+/testing).*)',
        headers: [
          ...securityHeaders,
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
      // bot routes except testing
      {
        source: '/dashboard/bots/:botId/:path((?!testing).*)',
        headers: [
          ...securityHeaders,
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
      {
        source: '/chat/:path*',
        headers: [
          ...securityHeaders,
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
        ],
      },
    ]
  },
}

export default nextConfig
