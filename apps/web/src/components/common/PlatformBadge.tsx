'use client'

import React from 'react'
import { CheckCircle2, Sparkles, FlaskConical, Crown, ShieldCheck, Award } from 'lucide-react'

export type BadgeType = 'verified' | 'early_supporter' | 'beta_tester' | string

interface PlatformBadgeProps {
  badgeId: BadgeType
  size?: number
  showLabel?: boolean
  className?: string
}

export function PlatformBadge({
  badgeId,
  size = 15,
  showLabel = false,
  className = '',
}: PlatformBadgeProps) {
  switch (badgeId) {
    case 'verified':
      return (
        <span
          title="Verified Account • Identity verified by Private Voices"
          className={`inline-flex items-center gap-1 text-sky-500 flex-shrink-0 cursor-default select-none ${className}`}
        >
          <CheckCircle2
            size={size}
            className="fill-sky-500 text-white dark:text-slate-900"
          />
          {showLabel && <span className="text-[11px] font-bold text-sky-500">Verified</span>}
        </span>
      )

    case 'early_supporter':
      return (
        <span
          title="Early Supporter • Pioneer of the Private Voices Preview Program"
          className={`inline-flex items-center gap-1 text-amber-500 flex-shrink-0 cursor-default select-none ${className}`}
        >
          <span className="p-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
            <Sparkles size={size - 2} className="text-amber-500 fill-amber-500/30" />
          </span>
          {showLabel && <span className="text-[11px] font-bold text-amber-500">Early Supporter</span>}
        </span>
      )

    case 'beta_tester':
      return (
        <span
          title="Beta Tester • Rigorous testing contributor"
          className={`inline-flex items-center gap-1 text-purple-500 flex-shrink-0 cursor-default select-none ${className}`}
        >
          <span className="p-0.5 rounded-full bg-purple-500/10 border border-purple-500/20">
            <FlaskConical size={size - 2} className="text-purple-500 fill-purple-500/30" />
          </span>
          {showLabel && <span className="text-[11px] font-bold text-purple-500">Beta Tester</span>}
        </span>
      )

    case 'owner':
      return (
        <span
          title="Community Owner"
          className={`inline-flex items-center gap-1 text-amber-500 flex-shrink-0 cursor-default select-none ${className}`}
        >
          <span className="p-0.5 rounded-full bg-amber-500/10 border border-amber-500/25">
            <Crown size={size - 2} className="text-amber-500 fill-amber-500/30" />
          </span>
          {showLabel && <span className="text-[10px] font-bold text-amber-600">Owner</span>}
        </span>
      )

    case 'moderator':
      return (
        <span
          title="Community Moderator"
          className={`inline-flex items-center gap-1 text-purple-600 flex-shrink-0 cursor-default select-none ${className}`}
        >
          <span className="p-0.5 rounded-full bg-purple-500/10 border border-purple-500/25">
            <ShieldCheck size={size - 2} className="text-purple-600 fill-purple-500/20" />
          </span>
          {showLabel && <span className="text-[10px] font-bold text-purple-600">Mod</span>}
        </span>
      )

    case 'vip':
      return (
        <span
          title="VIP Member"
          className={`inline-flex items-center gap-1 text-emerald-600 flex-shrink-0 cursor-default select-none ${className}`}
        >
          <span className="p-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25">
            <Award size={size - 2} className="text-emerald-600 fill-emerald-500/30" />
          </span>
          {showLabel && <span className="text-[10px] font-bold text-emerald-600">VIP</span>}
        </span>
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
  className?: string
}

export function UserBadgesRow({
  badges,
  size = 15,
  showLabels = false,
  className = '',
}: UserBadgesRowProps) {
  if (!badges || badges.length === 0) return null

  return (
    <div className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}>
      {badges.map((b) => (
        <PlatformBadge key={b} badgeId={b} size={size} showLabel={showLabels} />
      ))}
    </div>
  )
}
