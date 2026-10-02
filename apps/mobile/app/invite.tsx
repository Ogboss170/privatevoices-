import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Clipboard,
  Alert,
} from 'react-native'
import { ArrowLeft, UserPlus, Copy, Share2, Check } from 'lucide-react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { colors } from '../constants/colors'

export default function InviteFriendsScreen() {
  const router = useRouter()
  const [username, setUsername] = useState<string>('username')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', data.user.id)
          .single()

        if (prof?.username) {
          setUsername(prof.username)
        }
      }
    })
  }, [])

  const inviteLink = `privatevoices.app/invite/${username}`

  function handleCopyLink() {
    Clipboard.setString(`https://${inviteLink}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleShare() {
    try {
      await Share.share({
        title: 'Join me on Private Voices',
        message: `Bring your friends to Private Voices! Connect with friends, share anonymous Whispers, and join topic communities: https://${inviteLink}`,
        url: `https://${inviteLink}`,
      })
    } catch (error) {
      handleCopyLink()
    }
  }

  return (
    <View style={styles.container}>
      {/* Top Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={colors.gray800} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Invite Friends</Text>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <UserPlus size={36} color={colors.brand} />
          </View>

          <Text style={styles.mainTitle}>Bring your friends to Private Voices.</Text>
          <Text style={styles.subtitle}>
            Let your friends connect with you, send anonymous Whispers, and explore interest communities.
          </Text>

          {/* Invite Link Display */}
          <View style={styles.linkBox}>
            <Text style={styles.linkText} numberOfLines={1}>
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
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
            <Share2 size={18} color="#ffffff" />
            <Text style={styles.shareBtnText}>Invite Friends</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.copyLinkBtn} onPress={handleCopyLink}>
            <Text style={styles.copyLinkText}>{copied ? 'Copied to Clipboard!' : 'Copy Invite Link'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.gray900 },
  content: { flex: 1, padding: 20, justifyContent: 'center' },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray200,
    gap: 16,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainTitle: { fontSize: 20, fontWeight: '800', color: colors.gray900, textAlign: 'center' },
  subtitle: { fontSize: 13, color: colors.gray500, textAlign: 'center', lineHeight: 18 },
  linkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray100,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    width: '100%',
    justifyContent: 'space-between',
  },
  linkText: { fontSize: 13, fontFamily: 'monospace', color: colors.gray800, flex: 1, marginRight: 8 },
  copyBtn: { padding: 4 },
  shareBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.brand,
    paddingVertical: 14,
    borderRadius: 14,
  },
  shareBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  copyLinkBtn: { paddingVertical: 8 },
  copyLinkText: { color: colors.brand, fontSize: 13, fontWeight: '600' },
})
