import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { CheckCircle2, Sparkles, FlaskConical, Crown, ShieldCheck, Award } from 'lucide-react-native'

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

    case 'owner':
      return (
        <View style={styles.badgeContainer}>
          <View style={styles.iconWrapAmber}>
            <Crown size={size - 2} color="#f59e0b" />
          </View>
          {showLabel && <Text style={[styles.label, { color: '#d97706' }]}>Owner</Text>}
        </View>
      )

    case 'moderator':
      return (
        <View style={styles.badgeContainer}>
          <View style={styles.iconWrapPurple}>
            <ShieldCheck size={size - 2} color="#9333ea" />
          </View>
          {showLabel && <Text style={[styles.label, { color: '#9333ea' }]}>Mod</Text>}
        </View>
      )

    case 'vip':
      return (
        <View style={styles.badgeContainer}>
          <View style={styles.iconWrapEmerald}>
            <Award size={size - 2} color="#059669" />
          </View>
          {showLabel && <Text style={[styles.label, { color: '#059669' }]}>VIP</Text>}
        </View>
      )

    default:
      return null
  }
}

export function CommunityRoleBadge({
  role,
  size = 14,
  showLabel = true,
}: {
  role?: 'owner' | 'moderator' | 'vip' | 'member' | string | null
  size?: number
  showLabel?: boolean
}) {
  if (!role || role === 'member') return null
  return <PlatformBadge badgeId={role} size={size} showLabel={showLabel} />
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
  iconWrapEmerald: {
    padding: 2,
    borderRadius: 99,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
})
