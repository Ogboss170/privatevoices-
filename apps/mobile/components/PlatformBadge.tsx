import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { CheckCircle2, Sparkles, FlaskConical } from 'lucide-react-native'

export type BadgeType = 'verified' | 'early_supporter' | 'beta_tester' | string

interface PlatformBadgeProps {
  badgeId: BadgeType
  size?: number
  showLabel?: boolean
}

export function PlatformBadge({ badgeId, size = 15, showLabel = false }: PlatformBadgeProps) {
  switch (badgeId) {
    case 'verified':
      return (
        <View style={styles.badgeContainer}>
          <CheckCircle2 size={size} color="#0284c7" />
          {showLabel && <Text style={[styles.label, { color: '#0284c7' }]}>Verified</Text>}
        </View>
      )

    case 'early_supporter':
      return (
        <View style={styles.badgeContainer}>
          <View style={styles.iconWrapAmber}>
            <Sparkles size={size - 2} color="#f59e0b" />
          </View>
          {showLabel && <Text style={[styles.label, { color: '#f59e0b' }]}>Early Supporter</Text>}
        </View>
      )

    case 'beta_tester':
      return (
        <View style={styles.badgeContainer}>
          <View style={styles.iconWrapPurple}>
            <FlaskConical size={size - 2} color="#a855f7" />
          </View>
          {showLabel && <Text style={[styles.label, { color: '#a855f7' }]}>Beta Tester</Text>}
        </View>
      )

    default:
      return null
  }
}

interface UserBadgesRowProps {
  badges?: string[]
  size?: number
  showLabels?: boolean
}

export function UserBadgesRow({ badges, size = 15, showLabels = false }: UserBadgesRowProps) {
  if (!badges || badges.length === 0) return null

  return (
    <View style={styles.row}>
      {badges.map((b) => (
        <PlatformBadge key={b} badgeId={b} size={size} showLabel={showLabels} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
  },
  iconWrapAmber: {
    padding: 2,
    borderRadius: 99,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  iconWrapPurple: {
    padding: 2,
    borderRadius: 99,
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
  },
})
