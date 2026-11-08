import { useI18n, SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n'
import { contentFs } from '@/utils/fontScale'
import { Etch } from '@/components/atoms/Etch'

interface Props {
  size?: 'sm' | 'md'
  showLabel?: boolean
}

export function LanguagePicker({ size = 'sm', showLabel = true }: Props) {
  const { lang, setLang, t } = useI18n()

  const fontSize = size === 'sm' ? 9 : 10
  const padX = size === 'sm' ? 6 : 8
  const padY = size === 'sm' ? 3 : 4

  return (
    <div
      title={t('lang.label')}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
      }}
    >
      {showLabel && <Etch>{t('lang.label').toUpperCase()}</Etch>}
      <div
        style={{
          display: 'inline-flex',
          background: 'var(--bg-inset)',
          border: '1px solid var(--edge-engrave)',
          borderRadius: 4,
          padding: 1,
          boxShadow: 'inset 0 1px 0 var(--edge-deep)',
        }}
        role="group"
        aria-label={t('lang.label')}
      >
        {SUPPORTED_LANGUAGES.map((opt) => {
          const active = lang === opt.code
          return (
            <button
              key={opt.code}
              type="button"
              onClick={() => setLang(opt.code as SupportedLanguage)}
              title={opt.label}
              style={{
                padding: `${padY}px ${padX}px`,
                background: active ? 'var(--bg-2)' : 'transparent',
                border: 'none',
                borderRadius: 2,
                fontFamily: 'var(--font-mono)',
                fontSize: contentFs(fontSize),
                letterSpacing: '0.04em',
                color: active ? 'var(--accent-bright)' : 'var(--fg-3)',
                fontWeight: active ? 600 : 400,
                cursor: 'pointer',
                boxShadow: active ? 'inset 0 1px 0 var(--bg-1)' : 'none',
                transition: 'color 120ms ease, background 120ms ease',
              }}
            >
              {opt.short}
            </button>
          )
        })}
      </div>
    </div>
  )
}
