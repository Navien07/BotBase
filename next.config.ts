import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

// Overrides for the testing console — microphone needed for voice recording
const testingHeaders = [
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
]

const nextConfig: NextConfig = {
  serverExternalPackages: ['voyageai', 'pdf-parse', 'unpdf', 'pdf2json', 'mammoth', 'sharp', 'cheerio', '@anthropic-ai/sdk', 'gpt-tokenizer'],
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }],
  },
  async headers() {
    return [
      {
        source: '/((?!chat).*)',
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
      // Testing console needs microphone access for voice recording
      {
        source: '/dashboard/bots/:botId/testing',
        headers: testingHeaders,
      },
    ]
  },
}

export default nextConfig
