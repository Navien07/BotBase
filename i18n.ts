import { notFound } from 'next/navigation'
import { getRequestConfig } from 'next-intl/server'

const locales = ['en', 'bm'] as const
export type Locale = (typeof locales)[number]

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = await requestLocale
  if (!locale || !locales.includes(locale as Locale)) notFound()

  return {
    locale,
    messages: (await import(`./lib/i18n/${locale}.json`)).default,
  }
})
