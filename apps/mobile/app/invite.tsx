import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Clipboard,
  Alert,
  ScrollView,
  Modal,
} from 'react-native'
import {
  ArrowLeft,
  UserPlus,
  Copy,
  Share2,
  Check,
  QrCode,
  Sparkles,
  Users,
  X,
  Award,
  Crown,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react-native'
import QRCode from 'react-native-qrcode-svg'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { colors } from '../constants/colors'
import { useTheme } from '../context/ThemeContext'

export default function InviteFriendsScreen() {
  const router = useRouter()
  const { colors: themeColors, isDark } = useTheme()
  const [username, setUsername] = useState<string>('')
  const [displayName, setDisplayName] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [showQrModal, setShowQrModal] = useState(false)
  const [referralCount, setReferralCount] = useState(0)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('id, username, display_name')
          .eq('id', data.user.id)
          .single()

        if (prof?.username) {
          setUsername(prof.username)
          setDisplayName(prof.display_name || prof.username)
        }

        try {
          const { count } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('referred_by', data.user.id)
          if (count !== null) {
            setReferralCount(count)
          }
        } catch {
          // Safe fallback
        }
      }
    })
  }, [])

  const inviteLink = `https://privatevoices.app/invite/${username || 'you'}`

  function handleCopyLink() {
    Clipboard.setString(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleShare() {
    try {
      await Share.share({
        title: 'Join me on Private Voices',
        message: `Hey! I'm on Private Voices — join me to connect freely, share candid moments, and send anonymous Whispers: ${inviteLink}`,
        url: inviteLink,
      })
    } catch {
      handleCopyLink()
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Top Header Bar */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: themeColors.surface,
            borderBottomColor: themeColors.surfaceBorder,
          },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={themeColors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>
          Invite Friends
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: themeColors.surface,
              borderColor: themeColors.surfaceBorder,
            },
          ]}
        >
          <View style={styles.iconCircle}>
            <UserPlus size={34} color={colors.brand} />
          </View>

          <Text style={[styles.mainTitle, { color: themeColors.textPrimary }]}>
            Bring your friends to Private Voices
          </Text>
          <Text style={[styles.subtitle, { color: themeColors.textMuted }]}>
            Share your invite link or QR code so friends can join your circle, follow your updates, and send anonymous Whispers.
          </Text>

          {/* Invite Link Display */}
          <View
            style={[
              styles.linkBox,
              {
                backgroundColor: isDark ? '#1e293b' : colors.gray100,
                borderColor: themeColors.surfaceBorder,
              },
            ]}
          >
            <Text
              style={[styles.linkText, { color: themeColors.textPrimary }]}
              numberOfLines={1}
            >
              {inviteLink}
            </Text>
            <TouchableOpacity style={styles.copyBtn} onPress={handleCopyLink}>
              {copied ? (
                <Check size={16} color="#059669" />
              ) : (
                <Copy size={16} color={colors.brand} />
              )}
            </TouchableOpacity>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
              <Share2 size={18} color="#ffffff" />
              <Text style={styles.shareBtnText}>Share Invite Link</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.qrBtn,
                {
                  backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                  borderColor: themeColors.surfaceBorder,
                },
              ]}
              onPress={() => setShowQrModal(true)}
            >
              <QrCode size={18} color={colors.brand} />
              <Text
                style={[styles.qrBtnText, { color: themeColors.textPrimary }]}
              >
                QR Code
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.copyLinkBtn}
            onPress={handleCopyLink}
          >
            <Text style={styles.copyLinkText}>
              {copied ? '✓ Copied to Clipboard!' : 'Copy Invite Link'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Stats & Referral Rewards Milestones */}
        <View
          style={[
            styles.rewardsContainer,
            {
              backgroundColor: themeColors.surface,
              borderColor: themeColors.surfaceBorder,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.rewardsHeader}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <Award size={16} color={colors.brand} />
                <Text style={styles.rewardsHeaderSub}>Referral Milestones</Text>
              </View>
              <Text style={[styles.rewardsHeaderTitle, { color: themeColors.textPrimary }]}>
                Your Referral Rewards
              </Text>
            </View>
            <View style={[styles.referralCounterPill, { backgroundColor: isDark ? '#1e293b' : '#f8fafc' }]}>
              <Text style={{ fontSize: 10, color: colors.gray500, fontWeight: '700', textTransform: 'uppercase' }}>
                Successful
              </Text>
              <Text style={[styles.referralBigCount, { color: colors.brand }]}>
                {referralCount}
              </Text>
            </View>
          </View>

          <Text style={{ fontSize: 12, color: themeColors.textMuted, marginBottom: 14 }}>
            {referralCount < 500
              ? `${500 - referralCount} more to unlock Community Ambassador`
              : referralCount < 5000
              ? `${5000 - referralCount} more to unlock Legendary Community Builder`
              : 'All referral milestone tiers unlocked!'}
          </Text>

          {/* Milestone 1: Community Ambassador */}
          <View
            style={[
              styles.milestoneCard,
              { backgroundColor: isDark ? '#451a03' : '#fffbeb', borderColor: '#fde68a' },
            ]}
          >
            <View style={styles.milestoneTop}>
              <View style={[styles.milestoneIconWrap, { backgroundColor: '#f59e0b' }]}>
                <Text style={{ fontSize: 16 }}>🟡</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.milestoneTitle, { color: isDark ? '#fef3c7' : '#78350f' }]}>
                    Community Ambassador
                  </Text>
                  <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                    <Text style={{ fontSize: 9, fontWeight: '700', color: '#b45309' }}>500 Ref</Text>
                  </View>
                </View>
                <Text style={[styles.milestoneDesc, { color: isDark ? '#fde68a' : '#92400e' }]}>
                  Recognition for helping grow Private Voices.
                </Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View style={{ marginTop: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? '#fef3c7' : '#92400e' }}>
                  Progress
                </Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: isDark ? '#fef3c7' : '#92400e' }}>
                  {referralCount} / 500
                </Text>
              </View>
              <View style={[styles.progressBarBg, { backgroundColor: isDark ? '#78350f' : '#fde68a' }]}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      backgroundColor: '#f59e0b',
                      width: `${Math.min(100, (referralCount / 500) * 100)}%`,
                    },
                  ]}
                />
              </View>
            </View>
          </View>

          {/* Milestone 2: Legendary Community Builder */}
          <View
            style={[
              styles.milestoneCard,
              { backgroundColor: '#0f172a', borderColor: '#f59e0b', borderWidth: 1.5 },
            ]}
          >
            <View style={styles.milestoneTop}>
              <View
                style={[
                  styles.milestoneIconWrap,
                  { backgroundColor: '#1e1b4b', borderColor: '#f59e0b', borderWidth: 1 },
                ]}
              >
                <Crown size={16} color="#facc15" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.milestoneTitle, { color: '#ffffff' }]}>
                    Legendary Community Builder
                  </Text>
                  <View style={{ backgroundColor: 'rgba(250, 204, 21, 0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                    <Text style={{ fontSize: 9, fontWeight: '800', color: '#facc15' }}>Blue & Gold</Text>
                  </View>
                </View>
                <Text style={[styles.milestoneDesc, { color: '#93c5fd' }]}>
                  Permanent prestige distinction for 5,000+ members.
                </Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View style={{ marginTop: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#bfdbfe' }}>
                  Progress
                </Text>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#facc15' }}>
                  {referralCount} / 5,000
                </Text>
              </View>
              <View style={[styles.progressBarBg, { backgroundColor: '#1e293b' }]}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      backgroundColor: '#3b82f6',
                      width: `${Math.min(100, (referralCount / 5000) * 100)}%`,
                    },
                  ]}
                />
              </View>
            </View>
          </View>

          {/* Identity Verification Distinction Note */}
          <View style={[styles.verificationNoteCard, { backgroundColor: isDark ? '#082f49' : '#f0f9ff', borderColor: '#bae6fd' }]}>
            <CheckCircle2 size={18} color="#0284c7" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: isDark ? '#e0f2fe' : '#0369a1' }}>
                Identity Verification (Blue Check)
              </Text>
              <Text style={{ fontSize: 11, color: isDark ? '#bae6fd' : '#0284c7', marginTop: 2, lineHeight: 15 }}>
                The official blue check is reserved strictly for real-world identity and account authenticity, awarded independently of referral milestones.
              </Text>
            </View>
          </View>

          {/* Anti-Cheating & Audit Notice */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <ShieldCheck size={14} color={colors.brand} />
            <Text style={{ fontSize: 11, color: themeColors.textMuted }}>
              Anti-abuse active. Only verified accounts count.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* QR Code Modal */}
      <Modal
        visible={showQrModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQrModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: themeColors.surface,
                borderColor: themeColors.surfaceBorder,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.closeModalBtn}
              onPress={() => setShowQrModal(false)}
            >
              <X size={20} color={themeColors.textMuted} />
            </TouchableOpacity>

            <Text
              style={[styles.modalTitle, { color: themeColors.textPrimary }]}
            >
              Scan to Join
            </Text>
            <Text
              style={[styles.modalSubtitle, { color: themeColors.textMuted }]}
            >
              Point camera to join @{username || 'user'} on Private Voices
            </Text>

            <View style={styles.qrWrapper}>
              <QRCode
                value={inviteLink}
                size={200}
                backgroundColor="#ffffff"
                color="#0f172a"
              />
            </View>

            <Text
              style={[styles.modalLink, { color: themeColors.textMuted }]}
              numberOfLines={1}
            >
              {inviteLink}
            </Text>

            <TouchableOpacity
              style={styles.modalDoneBtn}
              onPress={() => {
                setShowQrModal(false)
                handleCopyLink()
              }}
            >
              <Text style={styles.modalDoneBtnText}>
                {copied ? 'Copied Link!' : 'Copy & Close'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  content: { padding: 20, gap: 16 },
  card: {
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    gap: 16,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 13, textAlign: 'center', lineHeight: 18, paddingHorizontal: 10 },
  linkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    width: '100%',
    borderWidth: 1,
    justifyContent: 'space-between',
  },
  linkText: { fontSize: 12, fontFamily: 'monospace', flex: 1, marginRight: 8 },
  copyBtn: { padding: 4 },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.brand,
    paddingVertical: 14,
    borderRadius: 14,
  },
  shareBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  qrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  qrBtnText: { fontSize: 14, fontWeight: '700' },
  copyLinkBtn: { paddingVertical: 4 },
  copyLinkText: { color: colors.brand, fontSize: 13, fontWeight: '600' },

  rewardsContainer: {
    padding: 18,
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
  },
  rewardsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rewardsHeaderSub: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.brand,
    textTransform: 'uppercase',
  },
  rewardsHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  referralCounterPill: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  referralBigCount: {
    fontSize: 20,
    fontWeight: '900',
  },
  milestoneCard: {
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
  },
  milestoneTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  milestoneIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  milestoneDesc: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
  },
  verificationNoteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 4,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    gap: 12,
  },
  closeModalBtn: {
    alignSelf: 'flex-end',
    padding: 4,
  },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalSubtitle: { fontSize: 12, textAlign: 'center', paddingHorizontal: 12 },
  qrWrapper: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginVertical: 6,
  },
  modalLink: {
    fontSize: 11,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  modalDoneBtn: {
    width: '100%',
    backgroundColor: colors.brand,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  modalDoneBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
})

