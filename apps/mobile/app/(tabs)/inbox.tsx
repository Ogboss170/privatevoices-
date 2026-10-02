import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { Trash2, Send, CornerDownRight, Share2 } from 'lucide-react-native'
import { supabase } from '../../lib/supabase'
import { colors } from '../../constants/colors'

export default function InboxScreen() {
  const [activeTab, setActiveTab] = useState<'whispers' | 'messages'>('whispers')
  const [whispers, setWhispers] = useState<any[]>([])
  const [conversations, setConversations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [replyText, setReplyText] = useState<{ [key: string]: string }>({})
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

  async function handleReply(whisperId: string) {
    const text = replyText[whisperId]
    if (!text || !text.trim()) return

    const { error } = await supabase
      .from('whispers')
      .update({
        reply_content: text.trim(),
        replied_at: new Date().toISOString(),
      })
      .eq('id', whisperId)

    if (!error) {
      setWhispers((prev) =>
        prev.map((w) =>
          w.id === whisperId ? { ...w, reply_content: text.trim() } : w
        )
      )
      setReplyText((prev) => ({ ...prev, [whisperId]: '' }))
    }
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

  async function handleShareAsPost(whisper: any) {
    const postContent = `Anonymous Whisper:\n"${whisper.content}"\n\nReply: ${whisper.reply_content || ''}`
    const { error } = await supabase.from('posts').insert({
      author_id: currentUserId,
      content: postContent,
    })

    if (!error) {
      Alert.alert('Success', 'Whisper shared to your public feed!')
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

                {item.reply_content && (
                  <View style={styles.replyBox}>
                    <CornerDownRight size={14} color={colors.brand} />
                    <Text style={styles.replyText}>{item.reply_content}</Text>
                  </View>
                )}

                {!item.reply_content ? (
                  <View style={styles.replyForm}>
                    <TextInput
                      style={styles.replyInput}
                      placeholder="Write a reply..."
                      placeholderTextColor={colors.gray400}
                      value={replyText[item.id] || ''}
                      onChangeText={(t) => setReplyText({ ...replyText, [item.id]: t })}
                    />
                    <TouchableOpacity style={styles.replySubmitBtn} onPress={() => handleReply(item.id)}>
                      <Send size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.shareBtn}
                    onPress={() => handleShareAsPost(item)}
                  >
                    <Share2 size={14} color={colors.gray700} />
                    <Text style={styles.shareText}>Share as Post</Text>
                  </TouchableOpacity>
                )}
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
  replyBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.brandLight, padding: 10, borderRadius: 10 },
  replyText: { fontSize: 13, color: colors.brandDark, fontWeight: '600' },
  replyForm: { flexDirection: 'row', gap: 8, marginTop: 4 },
  replyInput: { flex: 1, borderWidth: 1, borderColor: colors.gray300, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13 },
  replySubmitBtn: { backgroundColor: colors.brand, paddingHorizontal: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: colors.gray100, borderRadius: 8, alignSelf: 'flex-end' },
  shareText: { fontSize: 12, fontWeight: '600', color: colors.gray700 },
  convCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', padding: 14, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.gray200 },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.brand },
  convInfo: { flex: 1 },
  convName: { fontSize: 15, fontWeight: '700', color: colors.gray900 },
  convMsg: { fontSize: 13, color: colors.gray500, marginTop: 2 },
})
