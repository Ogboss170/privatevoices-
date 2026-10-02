import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Share,
} from 'react-native'
import { Trash2, Share2, ShieldCheck } from 'lucide-react-native'
import { supabase } from '../../lib/supabase'
import { colors } from '../../constants/colors'

export default function InboxScreen() {
  const [activeTab, setActiveTab] = useState<'whispers' | 'messages'>('whispers')
  const [whispers, setWhispers] = useState<any[]>([])
  const [conversations, setConversations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id)
    })
  }, [])

  const fetchInboxData = useCallback(async () => {
    if (!currentUserId) return
    setLoading(true)

    if (activeTab === 'whispers') {
      const { data } = await supabase
        .from('whispers')
        .select('*')
        .eq('recipient_id', currentUserId)
        .order('created_at', { ascending: false })

      setWhispers(data ?? [])
    } else {
      const { data } = await supabase
        .from('conversations')
        .select(`
          *,
          user_a:profiles!conversations_user_a_id_fkey(id, username, display_name, avatar_url),
          user_b:profiles!conversations_user_b_id_fkey(id, username, display_name, avatar_url)
        `)
        .or(`user_a_id.eq.${currentUserId},user_b_id.eq.${currentUserId}`)
        .order('last_message_at', { ascending: false })

      setConversations(data ?? [])
    }
    setLoading(false)
    setRefreshing(false)
  }, [currentUserId, activeTab])

  useEffect(() => {
    fetchInboxData()
  }, [fetchInboxData])

  function handleRefresh() {
    setRefreshing(true)
    fetchInboxData()
  }

  function handleDelete(whisperId: string) {
    Alert.alert('Delete Whisper', 'Are you sure you want to delete this whisper?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('whispers').delete().eq('id', whisperId)
          if (!error) {
            setWhispers((prev) => prev.filter((w) => w.id !== whisperId))
          }
        },
      },
    ])
  }

  async function handleShareWhisper(whisper: any) {
    const textToShare = `Anonymous Whisper:\n"${whisper.content}"\n\n— via Private Voices`
    try {
      await Share.share({
        title: 'Anonymous Whisper',
        message: textToShare,
      })
    } catch {
      Alert.alert('Share Failed', 'Unable to open share menu.')
    }
  }

  return (
    <View style={styles.container}>
      {/* Tab Switcher */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'whispers' && styles.tabActive]}
          onPress={() => setActiveTab('whispers')}
        >
          <Text style={[styles.tabText, activeTab === 'whispers' && styles.tabTextActive]}>
            Whispers ({whispers.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'messages' && styles.tabActive]}
          onPress={() => setActiveTab('messages')}
        >
          <Text style={[styles.tabText, activeTab === 'messages' && styles.tabTextActive]}>
            Direct Messages
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.brand} size="large" />
        </View>
      ) : activeTab === 'whispers' ? (
        whispers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🤫</Text>
            <Text style={styles.emptyTitle}>No Whispers Yet</Text>
            <Text style={styles.emptyBody}>
              Share your profile link to receive anonymous messages from friends and followers.
            </Text>
          </View>
        ) : (
          <FlatList
            data={whispers}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.brand} />
            }
            renderItem={({ item }) => (
              <View style={styles.whisperCard}>
                <View style={styles.whisperHeader}>
                  <Text style={styles.whisperBadge}>🤫 Anonymous Whisper</Text>
                  <TouchableOpacity onPress={() => handleDelete(item.id)}>
                    <Trash2 size={16} color={colors.gray400} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.whisperContent}>"{item.content}"</Text>

                <View style={styles.whisperFooter}>
                  <View style={styles.anonymousTag}>
                    <ShieldCheck size={14} color="#059669" />
                    <Text style={styles.anonymousTagText}>Sender Hidden</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.shareBtn}
                    onPress={() => handleShareWhisper(item)}
                  >
                    <Share2 size={14} color={colors.gray700} />
                    <Text style={styles.shareText}>Share</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )
      ) : (
        /* Direct Messages */
        conversations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>💬</Text>
            <Text style={styles.emptyTitle}>No Direct Conversations</Text>
            <Text style={styles.emptyBody}>
              Start a direct conversation with users from their public profiles.
            </Text>
          </View>
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const partner = item.user_a.id === currentUserId ? item.user_b : item.user_a
              return (
                <TouchableOpacity style={styles.convCard}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>{partner.display_name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.convInfo}>
                    <Text style={styles.convName}>{partner.display_name}</Text>
                    <Text style={styles.convMsg}>{item.last_message || 'Tap to chat'}</Text>
                  </View>
                </TouchableOpacity>
              )
            }}
          />
        )
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
    paddingHorizontal: 16,
  },
  tab: { paddingVertical: 12, marginRight: 20 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.brand },
  tabText: { fontSize: 14, fontWeight: '500', color: colors.gray500 },
  tabTextActive: { color: colors.brand, fontWeight: '700' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.gray900, marginBottom: 8 },
  emptyBody: { fontSize: 14, color: colors.gray500, textAlign: 'center', lineHeight: 20 },
  listContent: { padding: 16, paddingBottom: 100 },
  whisperCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.gray200,
    gap: 10,
  },
  whisperHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  whisperBadge: { fontSize: 12, fontWeight: '700', color: colors.brand },
  whisperContent: { fontSize: 15, fontStyle: 'italic', color: colors.gray900, backgroundColor: colors.gray50, padding: 12, borderRadius: 10 },
  whisperFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  anonymousTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  anonymousTagText: { fontSize: 11, color: '#059669', fontWeight: '600' },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: colors.gray100, borderRadius: 8 },
  shareText: { fontSize: 12, fontWeight: '600', color: colors.gray700 },
  convCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', padding: 14, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.gray200 },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.brand },
  convInfo: { flex: 1 },
  convName: { fontSize: 15, fontWeight: '700', color: colors.gray900 },
  convMsg: { fontSize: 13, color: colors.gray500, marginTop: 2 },
})
