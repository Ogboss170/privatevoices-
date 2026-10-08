'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export type ThemeMode = 'system' | 'light' | 'dark'

export type SupportedLanguage =
  | 'en'
  | 'es'
  | 'fr'
  | 'de'
  | 'pt'
  | 'ja'
  | 'ar'
  | 'zh'

export const LANGUAGE_OPTIONS: { code: SupportedLanguage; label: string; nativeName: string }[] = [
  { code: 'en', label: 'English', nativeName: 'English (US)' },
  { code: 'es', label: 'Spanish', nativeName: 'Español' },
  { code: 'fr', label: 'French', nativeName: 'Français' },
  { code: 'de', label: 'German', nativeName: 'Deutsch' },
  | { code: 'pt', label: 'Portuguese', nativeName: 'Português' },
  { code: 'ja', label: 'Japanese', nativeName: '日本語' },
  { code: 'ar', label: 'Arabic', nativeName: 'العربية' },
  { code: 'zh', label: 'Chinese', nativeName: '简体中文' },
].filter(Boolean)

export interface WebDesignTokens {
  background: string
  surface: string
  surfaceBorder: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  brand: string
  brandLight: string
  cardBg: string
  inputBg: string
  inputBorder: string
}

interface WebThemeContextType {
  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode) => Promise<void>
  language: SupportedLanguage
  setLanguage: (lang: SupportedLanguage) => Promise<void>
  reduceMotion: boolean
  setReduceMotion: (val: boolean) => Promise<void>
  highContrast: boolean
  setHighContrast: (val: boolean) => Promise<void>
  compactMode: boolean
  setCompactMode: (val: boolean) => Promise<void>
  isDark: boolean
  tokens: WebDesignTokens
}

const STORAGE_KEYS = {
  THEME: 'pv_theme_mode',
  LANGUAGE: 'pv_language',
  REDUCE_MOTION: 'pv_reduce_motion',
  HIGH_CONTRAST: 'pv_high_contrast',
  COMPACT_MODE: 'pv_compact_mode',
}

const TOKENS_LIGHT: WebDesignTokens = {
  background: '#f9fafb',
  surface: '#ffffff',
  surfaceBorder: '#e5e7eb',
  textPrimary: '#111827',
  textSecondary: '#4b5563',
  textMuted: '#9ca3af',
  brand: '#7c3aed',
  brandLight: '#ede9fe',
  cardBg: '#ffffff',
  inputBg: '#ffffff',
  inputBorder: '#d1d5db',
}

const TOKENS_DARK: WebDesignTokens = {
  background: '#0b0f17',
  surface: '#111827',
  surfaceBorder: '#1f2937',
  textPrimary: '#f9fafb',
  textSecondary: '#9ca3af',
  textMuted: '#6b7280',
  brand: '#8b5cf6',
  brandLight: 'rgba(124, 58, 237, 0.2)',
  cardBg: '#111827',
  inputBg: '#1f2937',
  inputBorder: '#374151',
}

export const WebThemeContext = createContext<WebThemeContextType>({
  themeMode: 'system',
  setThemeMode: async () => {},
  language: 'en',
  setLanguage: async () => {},
  reduceMotion: false,
  setReduceMotion: async () => {},
  highContrast: false,
  setHighContrast: async () => {},
  compactMode: false,
  setCompactMode: async () => {},
  isDark: false,
  tokens: TOKENS_LIGHT,
})

export function WebThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const supabase = createSupabaseBrowserClient()
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system')
  const [language, setLanguageState] = useState<SupportedLanguage>('en')
  const [reduceMotion, setReduceMotionState] = useState(false)
  const [highContrast, setHighContrastState] = useState(false)
  const [compactMode, setCompactModeState] = useState(false)
  const [systemIsDark, setSystemIsDark] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  // 1. Detect browser system color scheme & motion preference
  useEffect(() => {
    if (typeof window === 'undefined') return

    const matchDark = window.matchMedia('(prefers-color-scheme: dark)')
    setSystemIsDark(matchDark.matches)

    const handler = (e: MediaQueryListEvent) => setSystemIsDark(e.matches)
    matchDark.addEventListener('change', handler)

    // Check system motion preference
    const matchMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (matchMotion.matches && localStorage.getItem(STORAGE_KEYS.REDUCE_MOTION) === null) {
      setReduceMotionState(true)
    }

    return () => matchDark.removeEventListener('change', handler)
  }, [])

  // 2. Load stored local preferences
  useEffect(() => {
    if (typeof window === 'undefined') return

    const t = localStorage.getItem(STORAGE_KEYS.THEME) as ThemeMode | null
    if (t === 'light' || t === 'dark' || t === 'system') setThemeModeState(t)

    const l = localStorage.getItem(STORAGE_KEYS.LANGUAGE) as SupportedLanguage | null
    if (l) setLanguageState(l)

    const rm = localStorage.getItem(STORAGE_KEYS.REDUCE_MOTION)
    if (rm !== null) setReduceMotionState(rm === 'true')

    const hc = localStorage.getItem(STORAGE_KEYS.HIGH_CONTRAST)
    if (hc !== null) setHighContrastState(hc === 'true')

    const cm = localStorage.getItem(STORAGE_KEYS.COMPACT_MODE)
    if (cm !== null) setCompactModeState(cm === 'true')
  }, [])

  // 3. Sync preferences with database for authenticated session
  const syncCloud = useCallback(async (uId: string) => {
    try {
      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', uId)
        .maybeSingle()

      if (prefs) {
        if (prefs.theme) {
          setThemeModeState(prefs.theme as ThemeMode)
          localStorage.setItem(STORAGE_KEYS.THEME, prefs.theme)
        }
        if (prefs.language) {
          setLanguageState(prefs.language as SupportedLanguage)
          localStorage.setItem(STORAGE_KEYS.LANGUAGE, prefs.language)
        }
        if (typeof prefs.reduce_motion === 'boolean') {
          setReduceMotionState(prefs.reduce_motion)
          localStorage.setItem(STORAGE_KEYS.REDUCE_MOTION, String(prefs.reduce_motion))
        }
        if (typeof prefs.high_contrast === 'boolean') {
          setHighContrastState(prefs.high_contrast)
          localStorage.setItem(STORAGE_KEYS.HIGH_CONTRAST, String(prefs.high_contrast))
        }
        if (typeof prefs.compact_mode === 'boolean') {
          setCompactModeState(prefs.compact_mode)
          localStorage.setItem(STORAGE_KEYS.COMPACT_MODE, String(prefs.compact_mode))
        }
      }
    } catch {
      // offline or table creation pending
    }
  }, [supabase])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id)
        syncCloud(data.user.id)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserId(session.user.id)
        syncCloud(session.user.id)
      } else {
        setUserId(null)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [syncCloud, supabase])

  const persist = async (key: string, value: any, colName: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, typeof value === 'boolean' ? String(value) : value)
    }
    if (userId) {
      try {
        await supabase.from('user_preferences').upsert(
          {
            user_id: userId,
            [colName]: value,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
      } catch {
        // fallback
      }
    }
  }

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode)
    await persist(STORAGE_KEYS.THEME, mode, 'theme')
  }

  const setLanguage = async (lang: SupportedLanguage) => {
    setLanguageState(lang)
    await persist(STORAGE_KEYS.LANGUAGE, lang, 'language')
  }

  const setReduceMotion = async (val: boolean) => {
    setReduceMotionState(val)
    await persist(STORAGE_KEYS.REDUCE_MOTION, val, 'reduce_motion')
  }

  const setHighContrast = async (val: boolean) => {
    setHighContrastState(val)
    await persist(STORAGE_KEYS.HIGH_CONTRAST, val, 'high_contrast')
  }

  const setCompactMode = async (val: boolean) => {
    setCompactModeState(val)
    await persist(STORAGE_KEYS.COMPACT_MODE, val, 'compact_mode')
  }

  const isDark =
    themeMode === 'dark' || (themeMode === 'system' && systemIsDark)

  // 4. Update HTML document root classes for Tailwind dark mode and accessibility tokens
  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement

    if (isDark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }

    if (reduceMotion) {
      root.classList.add('reduce-motion')
    } else {
      root.classList.remove('reduce-motion')
    }

    if (highContrast) {
      root.classList.add('high-contrast')
    } else {
      root.classList.remove('high-contrast')
    }

    if (compactMode) {
      root.classList.add('compact-mode')
    } else {
      root.classList.remove('compact-mode')
    }

    root.setAttribute('lang', language)
  }, [isDark, reduceMotion, highContrast, compactMode, language])

  const tokens = isDark ? TOKENS_DARK : TOKENS_LIGHT

  return (
    <WebThemeContext.Provider
      value={{
        themeMode,
        setThemeMode,
        language,
        setLanguage,
        reduceMotion,
        setReduceMotion,
        highContrast,
        setHighContrast,
        compactMode,
        setCompactMode,
        isDark,
        tokens,
      }}
    >
      {children}
    </WebThemeContext.Provider>
  )
}

export function useWebTheme() {
  return useContext(WebThemeContext)
}
