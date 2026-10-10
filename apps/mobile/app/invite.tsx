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

        {/* Stats & Perk Banners */}
        <View style={styles.perksRow}>
          <View
            style={[
              styles.perkCard,
              {
                backgroundColor: themeColors.surface,
                borderColor: themeColors.surfaceBorder,
              },
            ]}
          >
            <View style={styles.perkHeader}>
              <Users size={16} color={colors.brand} />
              <Text style={styles.perkLabel}>Invited Friends</Text>
            </View>
            <Text
              style={[styles.perkValue, { color: themeColors.textPrimary }]}
            >
              {referralCount}
            </Text>
            <Text style={[styles.perkDesc, { color: themeColors.textMuted }]}>
              Joined through your invite
            </Text>
          </View>

          <View
            style={[
              styles.perkCard,
              {
                backgroundColor: themeColors.surface,
                borderColor: themeColors.surfaceBorder,
              },
            ]}
          >
            <View style={styles.perkHeader}>
              <Award size={16} color="#f59e0b" />
              <Text style={[styles.perkLabel, { color: '#d97706' }]}>
                Preview Perk
              </Text>
            </View>
            <Text
              style={[styles.perkDesc, { color: themeColors.textMuted, marginTop: 4 }]}
            >
              Earn early supporter badge & perks when friends register.
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

  perksRow: {
    flexDirection: 'row',
    gap: 12,
  },
  perkCard: {
    flex: 1,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
  },
  perkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  perkLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.brand,
    textTransform: 'uppercase',
  },
  perkValue: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  perkDesc: {
    fontSize: 11,
    lineHeight: 15,
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

