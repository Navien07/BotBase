import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'IceBot — AI Agent Platform',
  description: 'Deploy intelligent AI agents across WhatsApp, Telegram, and Web',
  openGraph: {
    title: 'IceBot — AI Agent Platform',
    description: 'Deploy intelligent AI agents across WhatsApp, Telegram, and Web',
    siteName: 'IceBot',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'IceBot — AI Agent Platform',
    description: 'Deploy intelligent AI agents across WhatsApp, Telegram, and Web',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster
          theme="dark"
          position="top-right"
          toastOptions={{
            style: {
              background: 'var(--bb-surface)',
              border: '1px solid var(--bb-border)',
              color: 'var(--bb-text-1)',
            },
          }}
        />
      </body>
    </html>
  )
}
