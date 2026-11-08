export type SupportedLanguage = 'zh-CN' | 'zh-TW' | 'en' | 'ja'

export interface LanguageOption {
  code: SupportedLanguage
  label: string
  short: string
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'zh-CN', label: '简体中文', short: '简' },
  { code: 'zh-TW', label: '繁體中文', short: '繁' },
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'ja', label: '日本語', short: '日' },
]

export type TranslationDict = Record<string, string>
