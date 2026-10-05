import React, { createContext, useContext, useEffect, useState } from 'react'
import { useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type ThemeMode = 'system' | 'light' | 'dark'

interface ThemeContextType {
  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode) => Promise<void>
  isDark: boolean
  colors: {
    background: string
    surface: string
    surfaceBorder: string
    textPrimary: string
    textSecondary: string
    textMuted: string
    brand: string
    brandLight: string
    inputBg: string
    inputBorder: string
    cardBg: string
    headerBg: string
  }
}

const THEME_STORAGE_KEY = '@pv_theme_mode'

export const ThemeContext = createContext<ThemeContextType>({
  themeMode: 'system',
  setThemeMode: async () => {},
  isDark: false,
  colors: {
    background: '#f9fafb',
    surface: '#ffffff',
    surfaceBorder: '#e5e7eb',
    textPrimary: '#111827',
    textSecondary: '#4b5563',
    textMuted: '#9ca3af',
    brand: '#7c3aed',
    brandLight: '#ede9fe',
    inputBg: '#f3f4f6',
    inputBorder: '#d1d5db',
    cardBg: '#ffffff',
    headerBg: '#ffffff',
  },
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme()
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system')

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setThemeModeState(saved as ThemeMode)
      }
    })
  }, [])

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode)
    await AsyncStorage.setItem(THEME_STORAGE_KEY, mode)
  }

  const isDark =
    themeMode === 'dark' || (themeMode === 'system' && systemScheme === 'dark')

  const themeColors = {
    background: isDark ? '#0b0f17' : '#f9fafb',
    surface: isDark ? '#111827' : '#ffffff',
    surfaceBorder: isDark ? '#1f2937' : '#e5e7eb',
    textPrimary: isDark ? '#f9fafb' : '#111827',
    textSecondary: isDark ? '#9ca3af' : '#4b5563',
    textMuted: isDark ? '#6b7280' : '#9ca3af',
    brand: '#7c3aed',
    brandLight: isDark ? 'rgba(124, 58, 237, 0.2)' : '#ede9fe',
    inputBg: isDark ? '#1f2937' : '#f3f4f6',
    inputBorder: isDark ? '#374151' : '#d1d5db',
    cardBg: isDark ? '#111827' : '#ffffff',
    headerBg: isDark ? '#111827' : '#ffffff',
  }

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        setThemeMode,
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
