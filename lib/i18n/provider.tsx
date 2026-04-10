'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import en from './en.json'
import bm from './bm.json'

export type Lang = 'en' | 'bm'

interface I18nContextValue {
  lang: Lang
  t: (key: string) => string
  setLang: (lang: Lang) => void
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'en',
  t: (k) => k,
  setLang: () => {},
})

const messages: Record<Lang, Record<string, unknown>> = {
  en: en as unknown as Record<string, unknown>,
  bm: bm as unknown as Record<string, unknown>,
}

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current && typeof current === 'object') {
      current = (current as Record<string, unknown>)[part]
    } else {
      return path
    }
  }
  return typeof current === 'string' ? current : path
}

export function LanguageProvider({
  children,
  defaultLang = 'en',
}: {
  children: React.ReactNode
  defaultLang?: Lang
}) {
  const [lang, setLangState] = useState<Lang>(defaultLang)

  useEffect(() => {
    const stored = localStorage.getItem('bb_lang') as Lang | null
    if (stored === 'en' || stored === 'bm') setLangState(stored)
  }, [])

  function setLang(l: Lang) {
    setLangState(l)
    localStorage.setItem('bb_lang', l)
    document.cookie = `bb_lang=${l};path=/;max-age=31536000`
  }

  function t(key: string): string {
    return getNestedValue(messages[lang], key)
  }

  return (
    <I18nContext.Provider value={{ lang, t, setLang }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useTranslation() {
  return useContext(I18nContext)
}
