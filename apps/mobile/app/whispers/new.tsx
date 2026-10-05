import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  FlatList,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { ArrowLeft, Send, Search, Lock, UserCheck, ShieldCheck, Check } from 'lucide-react-native'
import { Image } from 'expo-image'
import { supabase } from '../../lib/supabase'
import { colors } from '../../constants/colors'

export default function NewWhisperScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const initialRecipientId = (params.recipientId as string) || null

  const [searchQuery, setSearchQuery] = useState('')
  const [recipient, setRecipient] = useState<any | null>(null)
  const [matchingUsers, setMatchingUsers] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [whisperContent, setWhisperContent] = useState('')
  const [sending, setSending] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setCurrentUserId(data.user.id)
      }
    })

    if (initialRecipientId) {
      fetchRecipientById(initialRecipientId)
    }
  }, [initialRecipientId])

  async function fetchRecipientById(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .eq('id', userId)
      .maybeSingle()
    if (data) setRecipient(data)
  }

  async function handleSearchUsers(query: string) {
    setSearchQuery(query)
    if (!query.trim()) {
      setMatchingUsers([])
      return
    }

    setSearching(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .or(`username.ilike.%${query.trim()}%,display_name.ilike.%${query.trim()}%`)
      .neq('id', currentUserId || '')
      .limit(10)

    setMatchingUsers(data || [])
    setSearching(false)
  }

  async function handleSendWhisper() {
    if (!recipient || !whisperContent.trim()) return

    setSending(true)

    const { error } = await supabase.from('whispers').insert({
      recipient_id: recipient.id,
      content: whisperContent.trim(),
      is_read: false,
    })

    if (!error) {
      // Send notification to recipient
      await supabase.from('notifications').insert({
        recipient_id: recipient.id,
        actor_id: currentUserId,
        type: 'whisper_received',
        title: 'Anonymous Whisper Received 🤫',
        message: 'Someone sent you an anonymous Whisper.',
        entity_type: 'whisper',
        is_read: false,
      })

      setSending(false)
      Alert.alert(
        'Whisper Sent 🤫',
        `Your anonymous message has been delivered to @${recipient.username}. Your identity is 100% protected.`,
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      )
    } else {
      setSending(false)
      Alert.alert('Delivery Failed', error.message)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={20} color={colors.gray800} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Anonymous Whisper</Text>
            <View style={styles.secBadge}>
              <ShieldCheck size={12} color="#10b981" />
              <Text style={styles.secText}>100% Anonymous & Encrypted</Text>
            </View>
          </View>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
          {/* Step 1: Select Recipient */}
          <Text style={styles.sectionLabel}>1. SELECT RECIPIENT</Text>
          {recipient ? (
            <View style={styles.selectedRecipientCard}>
              <View style={styles.recipientInfo}>
                <View style={styles.avatarCircle}>
                  {recipient.avatar_url ? (
                    <Image source={{ uri: recipient.avatar_url }} style={styles.avatarImg} />
                  ) : (
                    <Text style={styles.avatarLetter}>
                      {recipient.display_name?.charAt(0)?.toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recipientName}>{recipient.display_name}</Text>
                  <Text style={styles.recipientHandle}>@{recipient.username}</Text>
                </View>
                <TouchableOpacity
                  style={styles.changeBtn}
                  onPress={() => {
                    setRecipient(null)
                    setSearchQuery('')
                  }}
                >
                  <Text style={styles.changeBtnText}>Change</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.searchWrap}>
              <View style={styles.searchBar}>
                <Search size={18} color={colors.gray400} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search user by @username or name..."
                  placeholderTextColor={colors.gray400}
                  value={searchQuery}
                  onChangeText={handleSearchUsers}
                />
              </View>

              {searching ? (
                <ActivityIndicator size="small" color={colors.brand} style={{ marginVertical: 12 }} />
              ) : (
                matchingUsers.length > 0 && (
                  <View style={styles.searchResultsList}>
                    {matchingUsers.map((u) => (
                      <TouchableOpacity
                        key={u.id}
                        style={styles.userRow}
                        onPress={() => {
                          setRecipient(u)
                          setMatchingUsers([])
                        }}
                      >
                        <View style={styles.miniAvatar}>
                          {u.avatar_url ? (
                            <Image source={{ uri: u.avatar_url }} style={styles.miniAvatarImg} />
                          ) : (
                            <Text style={styles.miniAvatarText}>{u.display_name?.charAt(0)}</Text>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.userRowName}>{u.display_name}</Text>
                          <Text style={styles.userRowHandle}>@{u.username}</Text>
                        </View>
                        <Check size={16} color={colors.brand} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )
              )}
            </View>
          )}

          {/* Step 2: Compose Message */}
          <Text style={[styles.sectionLabel, { marginTop: 24 }]}>2. YOUR SECRET WHISPER</Text>
          <View style={styles.composerCard}>
            <TextInput
              style={styles.whisperInput}
              multiline
              placeholder="Write your secret message... They will never know who sent it."
              placeholderTextColor={colors.gray400}
              value={whisperContent}
              onChangeText={setWhisperContent}
              maxLength={500}
            />
            <Text style={styles.charCounter}>{whisperContent.length} / 500</Text>
          </View>

          {/* Anonymity Banner */}
          <View style={styles.anonymityInfoBox}>
            <Lock size={16} color="#8b5cf6" />
            <Text style={styles.anonymityInfoText}>
              Your sender ID is completely stripped before saving to the database. Not even moderators can trace this back to your account.
            </Text>
          </View>

          {/* Submit Action Button */}
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!recipient || !whisperContent.trim() || sending) && styles.sendBtnDisabled,
            ]}
            disabled={!recipient || !whisperContent.trim() || sending}
            onPress={handleSendWhisper}
          >
            {sending ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <View style={styles.btnRow}>
                <Send size={18} color="#ffffff" />
                <Text style={styles.sendBtnText}>Send Anonymous Whisper 🤫</Text>
              </View>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
    gap: 12,
  },
  backBtn: { padding: 6, borderRadius: 8, backgroundColor: colors.gray100 },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.gray900 },
  secBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  secText: { fontSize: 11, color: '#10b981', fontWeight: '600' },

  body: { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 60 },

  sectionLabel: { fontSize: 12, fontWeight: '800', color: colors.gray500, letterSpacing: 0.5, marginBottom: 8 },

  selectedRecipientCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.brand + '40',
  },
  recipientInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 44, height: 44 },
  avatarLetter: { fontSize: 18, fontWeight: '700', color: colors.brand },
  recipientName: { fontSize: 15, fontWeight: '700', color: colors.gray900 },
  recipientHandle: { fontSize: 13, color: colors.gray500 },
  changeBtn: { backgroundColor: colors.gray100, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  changeBtnText: { fontSize: 12, fontWeight: '700', color: colors.gray700 },

  searchWrap: { gap: 8 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.gray200,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.gray900 },

  searchResultsList: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.gray200,
    overflow: 'hidden',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray100,
  },
  miniAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  miniAvatarImg: { width: 36, height: 36 },
  miniAvatarText: { fontSize: 14, fontWeight: '700', color: colors.brand },
  userRowName: { fontSize: 14, fontWeight: '700', color: colors.gray900 },
  userRowHandle: { fontSize: 12, color: colors.gray500 },

  composerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  whisperInput: {
    fontSize: 15,
    color: colors.gray900,
    minHeight: 120,
    textAlignVertical: 'top',
    lineHeight: 22,
  },
  charCounter: { fontSize: 11, color: colors.gray400, textAlign: 'right', marginTop: 4 },

  anonymityInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f5f3ff',
    padding: 12,
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#ddd6fe',
  },
  anonymityInfoText: { flex: 1, fontSize: 12, color: '#6d28d9', lineHeight: 17 },

  sendBtn: {
    marginTop: 20,
    backgroundColor: '#8b5cf6',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.45 },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sendBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
})
