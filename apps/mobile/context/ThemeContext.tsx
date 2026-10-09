import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../lib/supabase'

import {
  type SupportedLanguage,
  LANGUAGE_OPTIONS,
  TRANSLATIONS,
  getTranslation,
  type TranslationDictionary,
} from '@private-voices/shared'

export type ThemeMode = 'system' | 'light' | 'dark'
export { LANGUAGE_OPTIONS, TRANSLATIONS, type SupportedLanguage, type TranslationDictionary }

export interface DesignTokens {
  background: string
  surface: string
  surfaceBorder: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  text?: string
  brand: string
  brandLight: string
  inputBg: string
  inputBorder: string
  cardBg: string
  headerBg: string
  danger: string
  success: string
  warning: string
}

interface ThemeContextType {
  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode) => Promise<void>
  language: SupportedLanguage
  setLanguage: (lang: SupportedLanguage) => Promise<void>
  t: TranslationDictionary
  reduceMotion: boolean
  setReduceMotion: (val: boolean) => Promise<void>
  highContrast: boolean
  setHighContrast: (val: boolean) => Promise<void>
  compactMode: boolean
  setCompactMode: (val: boolean) => Promise<void>
  isDark: boolean
  colors: DesignTokens
}

const STORAGE_KEYS = {
  THEME: '@pv_theme_mode',
  LANGUAGE: '@pv_language',
  REDUCE_MOTION: '@pv_reduce_motion',
  HIGH_CONTRAST: '@pv_high_contrast',
  COMPACT_MODE: '@pv_compact_mode',
}

const DEFAULT_TOKENS_LIGHT: DesignTokens = {
  background: '#fafafa',
  surface: '#ffffff',
  surfaceBorder: '#efefef',
  textPrimary: '#121212',
  textSecondary: '#737373',
  textMuted: '#8e8e8e',
  text: '#121212',
  brand: '#7c3aed',
  brandLight: '#ede9fe',
  inputBg: '#fafafa',
  inputBorder: '#dbdbdb',
  cardBg: '#ffffff',
  headerBg: '#ffffff',
  danger: '#ef4444',
  success: '#10b981',
  warning: '#f59e0b',
}

const DEFAULT_TOKENS_DARK: DesignTokens = {
  background: '#000000',
  surface: '#121212',
  surfaceBorder: '#262626',
  textPrimary: '#f5f5f5',
  textSecondary: '#a8a8a8',
  textMuted: '#737373',
  text: '#f5f5f5',
  brand: '#8b5cf6',
  brandLight: 'rgba(139, 92, 246, 0.15)',
  inputBg: '#1a1a1a',
  inputBorder: '#363636',
  cardBg: '#121212',
  headerBg: '#121212',
  danger: '#f87171',
  success: '#34d399',
  warning: '#fbbf24',
}

const HIGH_CONTRAST_TOKENS_LIGHT: DesignTokens = {
  ...DEFAULT_TOKENS_LIGHT,
  background: '#ffffff',
  surface: '#ffffff',
  surfaceBorder: '#000000',
  textPrimary: '#000000',
  textSecondary: '#111827',
  textMuted: '#374151',
  brand: '#5b21b6',
  inputBorder: '#000000',
}

const HIGH_CONTRAST_TOKENS_DARK: DesignTokens = {
  ...DEFAULT_TOKENS_DARK,
  background: '#000000',
  surface: '#0a0a0a',
  surfaceBorder: '#ffffff',
  textPrimary: '#ffffff',
  textSecondary: '#f3f4f6',
  textMuted: '#d1d5db',
  brand: '#a78bfa',
  inputBorder: '#ffffff',
}

export const ThemeContext = createContext<ThemeContextType>({
  themeMode: 'system',
  setThemeMode: async () => {},
  language: 'en',
  setLanguage: async () => {},
  t: getTranslation('en'),
  reduceMotion: false,
  setReduceMotion: async () => {},
  highContrast: false,
  setHighContrast: async () => {},
  compactMode: false,
  setCompactMode: async () => {},
  isDark: false,
  colors: DEFAULT_TOKENS_LIGHT,
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme()
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system')
  const [language, setLanguageState] = useState<SupportedLanguage>('en')
  const [reduceMotion, setReduceMotionState] = useState(false)
  const [highContrast, setHighContrastState] = useState(false)
  const [compactMode, setCompactModeState] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  // 1. Load cached preferences from AsyncStorage immediately
  useEffect(() => {
    async function loadLocalPrefs() {
      try {
        const [t, l, rm, hc, cm] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.THEME),
          AsyncStorage.getItem(STORAGE_KEYS.LANGUAGE),
          AsyncStorage.getItem(STORAGE_KEYS.REDUCE_MOTION),
          AsyncStorage.getItem(STORAGE_KEYS.HIGH_CONTRAST),
          AsyncStorage.getItem(STORAGE_KEYS.COMPACT_MODE),
        ])

        if (t === 'light' || t === 'dark' || t === 'system') setThemeModeState(t)
        if (l) setLanguageState(l as SupportedLanguage)
        if (rm !== null) setReduceMotionState(rm === 'true')
        if (hc !== null) setHighContrastState(hc === 'true')
        if (cm !== null) setCompactModeState(cm === 'true')
      } catch (err) {
        console.error('Error loading local appearance prefs:', err)
      }
    }
    loadLocalPrefs()
  }, [])

  // 2. Sync with cloud preferences for authenticated user
  const syncWithCloud = useCallback(async (uId: string) => {
    try {
      const { data: cloudPrefs } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', uId)
        .maybeSingle()

      if (cloudPrefs) {
        if (cloudPrefs.theme) {
          setThemeModeState(cloudPrefs.theme as ThemeMode)
          AsyncStorage.setItem(STORAGE_KEYS.THEME, cloudPrefs.theme)
        }
        if (cloudPrefs.language) {
          setLanguageState(cloudPrefs.language as SupportedLanguage)
          AsyncStorage.setItem(STORAGE_KEYS.LANGUAGE, cloudPrefs.language)
        }
        if (typeof cloudPrefs.reduce_motion === 'boolean') {
          setReduceMotionState(cloudPrefs.reduce_motion)
          AsyncStorage.setItem(STORAGE_KEYS.REDUCE_MOTION, String(cloudPrefs.reduce_motion))
        }
        if (typeof cloudPrefs.high_contrast === 'boolean') {
          setHighContrastState(cloudPrefs.high_contrast)
          AsyncStorage.setItem(STORAGE_KEYS.HIGH_CONTRAST, String(cloudPrefs.high_contrast))
        }
        if (typeof cloudPrefs.compact_mode === 'boolean') {
          setCompactModeState(cloudPrefs.compact_mode)
          AsyncStorage.setItem(STORAGE_KEYS.COMPACT_MODE, String(cloudPrefs.compact_mode))
        }
      }
    } catch {
      // If table doesn't exist yet or offline, local prefs remain active
    }
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id)
        syncWithCloud(data.user.id)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserId(session.user.id)
        syncWithCloud(session.user.id)
      } else {
        setUserId(null)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [syncWithCloud])

  // Helper to persist updates locally and to Supabase
  const persistPref = async (key: string, value: any, cloudCol?: string) => {
    await AsyncStorage.setItem(key, typeof value === 'boolean' ? String(value) : value)
    if (userId && cloudCol) {
      try {
        await supabase.from('user_preferences').upsert(
          {
            user_id: userId,
            [cloudCol]: value,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
      } catch {
        // Fallback to local
      }
    }
  }

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode)
    await persistPref(STORAGE_KEYS.THEME, mode, 'theme')
  }

  const setLanguage = async (lang: SupportedLanguage) => {
    setLanguageState(lang)
    await persistPref(STORAGE_KEYS.LANGUAGE, lang, 'language')
  }

  const setReduceMotion = async (val: boolean) => {
    setReduceMotionState(val)
    await persistPref(STORAGE_KEYS.REDUCE_MOTION, val, 'reduce_motion')
  }

  const setHighContrast = async (val: boolean) => {
    setHighContrastState(val)
    await persistPref(STORAGE_KEYS.HIGH_CONTRAST, val, 'high_contrast')
  }

  const setCompactMode = async (val: boolean) => {
    setCompactModeState(val)
    await persistPref(STORAGE_KEYS.COMPACT_MODE, val, 'compact_mode')
  }

  const isDark =
    themeMode === 'dark' || (themeMode === 'system' && systemScheme === 'dark')

  let themeColors: DesignTokens
  if (highContrast) {
    themeColors = isDark ? HIGH_CONTRAST_TOKENS_DARK : HIGH_CONTRAST_TOKENS_LIGHT
  } else {
    themeColors = isDark ? DEFAULT_TOKENS_DARK : DEFAULT_TOKENS_LIGHT
  }

  const t = getTranslation(language)

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        setThemeMode,
        language,
        setLanguage,
        t,
        reduceMotion,
        setReduceMotion,
        highContrast,
        setHighContrast,
        compactMode,
        setCompactMode,
        isDark,
        colors: themeColors,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
