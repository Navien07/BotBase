import type { NextConfig } from 'next'

// microphone=(self) so the dashboard can request mic permission (voice recording).
// The browser still prompts the user — this only prevents silent blocking.
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
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
    ]
  },
}

export default nextConfig
