import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { SupportedLanguage } from './types'
import { zhCN } from './locales/zh-CN'
import { zhTW } from './locales/zh-TW'
import { en } from './locales/en'
import { ja } from './locales/ja'

const STORAGE_KEY = 'ran.language'

const DICTIONARIES = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  en,
  ja,
} as const

function resolveInitialLanguage(): SupportedLanguage {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && saved in DICTIONARIES) {
      return saved as SupportedLanguage
    }
  } catch {
    /* ignore */
  }

  if (typeof navigator !== 'undefined' && navigator.language) {
    const nav = navigator.language.toLowerCase()
    if (nav.startsWith('ja')) return 'ja'
    if (nav === 'zh-tw' || nav === 'zh-hk' || nav === 'zh-mo') return 'zh-TW'
    if (nav.startsWith('zh')) return 'zh-CN'
    if (nav.startsWith('en')) return 'en'
  }

  return 'zh-CN'
}

interface I18nContextValue {
  lang: SupportedLanguage
  setLang: (lang: SupportedLanguage) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({
  children,
  defaultLang,
}: {
  children: React.ReactNode
  defaultLang?: SupportedLanguage
}) {
  const [lang, setLangState] = useState<SupportedLanguage>(() => {
    if (defaultLang && defaultLang in DICTIONARIES) return defaultLang
    return resolveInitialLanguage()
  })

  const setLang = (next: SupportedLanguage) => {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang
    }
  }, [lang])

  const t = useMemo(() => {
    const dict = DICTIONARIES[lang] ?? zhCN
    return (key: string, params?: Record<string, string | number>): string => {
      let str = dict[key] ?? zhCN[key] ?? en[key] ?? key
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
        }
      }
      return str
    }
  }, [lang])

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    // Graceful fallback outside provider
    return {
      lang: 'zh-CN',
      setLang: () => {},
      t: (key: string, params?: Record<string, string | number>) => {
        let str = zhCN[key] ?? key
        if (params) {
          for (const [k, v] of Object.entries(params)) {
            str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
          }
        }
        return str
      },
    }
  }
  return ctx
}

export const useTranslation = useI18n
