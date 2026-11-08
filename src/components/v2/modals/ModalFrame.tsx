import { useEffect, type ReactNode } from 'react'
import { SerialPlate } from '@/components/atoms/SerialPlate'
import { contentFs } from '@/utils/fontScale'
import { useIsMobile } from '@/hooks/useMediaQuery'

interface ModalFrameProps {
  open: boolean
  onClose: () => void
  serial?: string
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  maxWidth?: number | string
}

export function ModalFrame({
  open,
  onClose,
  serial = 'MODAL',
  title,
  subtitle,
  children,
  footer,
  maxWidth = 720,
}: ModalFrameProps) {
  const isMobile = useIsMobile()

  // Close on Escape key
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  // Prevent body scrolling when open
  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? 12 : 24,
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(10, 10, 14, 0.72)',
          backdropFilter: 'blur(5px)',
          WebkitBackdropFilter: 'blur(5px)',
          animation: 'modalFadeIn 0.16s ease-out',
        }}
      />

      {/* Modal Dialog Card */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: isMobile ? '100%' : maxWidth,
          maxHeight: isMobile ? '92vh' : '86vh',
          background: 'var(--bg-1)',
          border: '1px solid var(--edge-engrave)',
          borderRadius: 4,
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.55), 0 0 1px rgba(255, 255, 255, 0.1) inset',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 201,
          animation: 'modalScaleIn 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: isMobile ? '12px 14px' : '14px 18px',
            borderBottom: '1px solid var(--edge-engrave)',
            background: 'var(--bg-0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            userSelect: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {serial && <SerialPlate>{serial}</SerialPlate>}
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: contentFs(13),
                  fontWeight: 600,
                  color: 'var(--fg-0)',
                  letterSpacing: '0.04em',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {title}
              </div>
              {subtitle && (
                <div
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: contentFs(10),
                    color: 'var(--fg-3)',
                    marginTop: 2,
                    letterSpacing: '0.02em',
                  }}
                >
                  {subtitle}
                </div>
              )}
            </div>
          </div>

          {/* Close X Button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              background: 'transparent',
              border: '1px solid var(--edge-engrave)',
              borderRadius: 3,
              color: 'var(--fg-2)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 14,
              lineHeight: 1,
              transition: 'all 0.12s ease',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--accent-bright)'
              e.currentTarget.style.borderColor = 'var(--accent)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--fg-2)'
              e.currentTarget.style.borderColor = 'var(--edge-engrave)'
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: isMobile ? 12 : 16,
            minHeight: 0,
          }}
        >
          {children}
        </div>

        {/* Optional Footer */}
        {footer && (
          <div
            style={{
              padding: isMobile ? '10px 14px' : '12px 18px',
              borderTop: '1px solid var(--edge-engrave)',
              background: 'var(--bg-0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 10,
            }}
          >
            {footer}
          </div>
        )}
      </div>

      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalScaleIn {
          from { opacity: 0; transform: scale(0.96) translateY(4px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}
