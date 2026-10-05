import React, { useEffect, useRef } from 'react'
import { View, StyleSheet, Animated as RNAnimated, Dimensions } from 'react-native'
import { useTheme } from '../context/ThemeContext'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

interface SkeletonCardProps {
  type?: 'post' | 'profile' | 'community'
}

export function SkeletonCard({ type = 'post' }: SkeletonCardProps) {
  const { colors: themeColors, isDark } = useTheme()
  const opacityAnim = useRef(new RNAnimated.Value(0.3)).current

  useEffect(() => {
    const pulse = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(opacityAnim, {
          toValue: 0.8,
          duration: 750,
          useNativeDriver: true,
        }),
        RNAnimated.timing(opacityAnim, {
          toValue: 0.3,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    )
    pulse.start()
    return () => pulse.stop()
  }, [opacityAnim])

  const highlightColor = isDark ? '#374151' : '#e5e7eb'

  if (type === 'community') {
    return (
      <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }]}>
        <View style={styles.headerRow}>
          <RNAnimated.View style={[styles.avatar, { backgroundColor: highlightColor, opacity: opacityAnim }]} />
          <View style={styles.textColumn}>
            <RNAnimated.View style={[styles.titleLine, { backgroundColor: highlightColor, opacity: opacityAnim }]} />
            <RNAnimated.View style={[styles.subLine, { backgroundColor: highlightColor, opacity: opacityAnim }]} />
          </View>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <RNAnimated.View style={[styles.avatar, { backgroundColor: highlightColor, opacity: opacityAnim }]} />
        <View style={styles.textColumn}>
          <RNAnimated.View style={[styles.nameLine, { backgroundColor: highlightColor, opacity: opacityAnim }]} />
          <RNAnimated.View style={[styles.handleLine, { backgroundColor: highlightColor, opacity: opacityAnim }]} />
        </View>
      </View>

      {/* Body lines */}
      <RNAnimated.View style={[styles.bodyLineFull, { backgroundColor: highlightColor, opacity: opacityAnim }]} />
      <RNAnimated.View style={[styles.bodyLineShort, { backgroundColor: highlightColor, opacity: opacityAnim }]} />

      {/* Media placeholder */}
      {type === 'post' && (
        <RNAnimated.View style={[styles.mediaPlaceholder, { backgroundColor: highlightColor, opacity: opacityAnim }]} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  textColumn: {
    gap: 6,
  },
  nameLine: {
    width: 120,
    height: 14,
    borderRadius: 7,
  },
  handleLine: {
    width: 80,
    height: 10,
    borderRadius: 5,
  },
  titleLine: {
    width: 160,
    height: 16,
    borderRadius: 8,
  },
  subLine: {
    width: 220,
    height: 12,
    borderRadius: 6,
  },
  bodyLineFull: {
    width: '100%',
    height: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  bodyLineShort: {
    width: '65%',
    height: 12,
    borderRadius: 6,
    marginBottom: 12,
  },
  mediaPlaceholder: {
    width: '100%',
    height: 180,
    borderRadius: 12,
  },
})
