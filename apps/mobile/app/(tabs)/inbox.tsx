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
  Modal,
  TextInput,
} from 'react-native'
import { Trash2, Share2, ShieldCheck, MessageCircle, UserPlus, Search, X } from 'lucide-react-native'
import { Image } from 'expo-image'
import { supabase } from '../../lib/supabase'
import { colors } from '../../constants/colors'
import { ChatModal } from '../../components/ChatModal'
import { useTheme } from '../../context/ThemeContext'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function InboxScreen() {
  const insets = useSafeAreaInsets()
  const { colors: themeColors } = useTheme()
  const [activeTab, setActiveTab] = useState<'whispers' | 'messages'>('whispers')
  const [whispers, setWhispers] = useState<any[]>([])
  const [conversations, setConversations] = useState<any[]>([])
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Active chat modal state
  const [selectedConversation, setSelectedConversation] = useState<{
    id: string
    partner: any
  } | null>(null)
  const [chatModalVisible, setChatModalVisible] = useState(false)

  // New Chat modal state
  const [showNewChatModal, setShowNewChatModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)

  const handleSearchUsers = async (query: string) => {
    setSearchQuery(query)
    if (!query.trim() || !currentUserId) {
      setSearchResults([])
      return
    }

    setSearching(true)
    const cleanQuery = query.trim().replace(/^@/, '')
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .neq('id', currentUserId)
      .or(`username.ilike.%${cleanQuery}%,display_name.ilike.%${cleanQuery}%`)
      .limit(10)

    setSearchResults(data ?? [])
    setSearching(false)
  }

  async function handleStartNewChat(targetUser: any) {
    if (!currentUserId) return
    setShowNewChatModal(false)

    const [userA, userB] = currentUserId < targetUser.id ? [currentUserId, targetUser.id] : [targetUser.id, currentUserId]
    const { data } = await supabase
      .from('conversations')
      .upsert({ user_a_id: userA, user_b_id: userB }, { onConflict: 'user_a_id,user_b_id' })
      .select('id')
      .single()

    if (data) {
      setSelectedConversation({
        id: data.id,
        partner: targetUser,
      })
      setChatModalVisible(true)
    }
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id)
    })
  }, [])

  const fetchInboxData = useCallback(async () => {
    if (!currentUserId) return
    setLoading(true)

    try {
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

        const convs = data ?? []
        setConversations(convs)

        // Count unread messages per conversation
        if (convs.length > 0) {
          const convIds = convs.map((c: any) => c.id)
          const { data: unreadMsgs } = await supabase
            .from('messages')
            .select('conversation_id')
            .in('conversation_id', convIds)
            .eq('is_read', false)
            .neq('sender_id', currentUserId)

          const counts: Record<string, number> = {}
          for (const m of unreadMsgs || []) {
            counts[m.conversation_id] = (counts[m.conversation_id] || 0) + 1
          }
          setUnreadCounts(counts)
        }
      }
    } catch (err) {
      console.error('Error fetching inbox data:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [currentUserId, activeTab])

  useEffect(() => {
    fetchInboxData()
  }, [fetchInboxData])

  // Real-time listener for incoming messages and whispers
  useEffect(() => {
    if (!currentUserId) return

    const channel = supabase
      .channel('mobile:inbox_updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => {
          fetchInboxData()
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'whispers' },
        (payload) => {
          if (payload.new?.recipient_id === currentUserId) {
            fetchInboxData()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId, fetchInboxData])

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

  function openChat(conversation: any) {
    const partner =
      conversation.user_a?.id === currentUserId
        ? conversation.user_b
        : conversation.user_a

    setSelectedConversation({
      id: conversation.id,
      partner,
    })
    setChatModalVisible(true)
  }

  function handleCloseChat() {
    setChatModalVisible(false)
    setSelectedConversation(null)
    fetchInboxData()
  }

  function formatTime(isoString?: string) {
    if (!isoString) return ''
    try {
      const date = new Date(isoString)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

      if (diffDays === 0) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      } else if (diffDays === 1) {
        return 'Yesterday'
      } else if (diffDays < 7) {
        return date.toLocaleDateString([], { weekday: 'short' })
      } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
      }
    } catch {
      return ''
    }
  }

  const totalUnreadDirect = Object.values(unreadCounts).reduce((a, b) => a + b, 0)

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Tab Switcher */}
      <View style={[styles.tabRow, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.surfaceBorder, paddingTop: insets.top + 6 }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'whispers' && styles.tabActive]}
          onPress={() => setActiveTab('whispers')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'whispers' ? colors.brand : themeColors.textSecondary },
              activeTab === 'whispers' && styles.tabTextActive,
            ]}
          >
            Whispers ({whispers.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'messages' && styles.tabActive]}
          onPress={() => setActiveTab('messages')}
        >
          <View style={styles.tabBadgeRow}>
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'messages' ? colors.brand : themeColors.textSecondary },
                activeTab === 'messages' && styles.tabTextActive,
              ]}
            >
              Direct Messages
            </Text>
            {totalUnreadDirect > 0 && (
              <View style={styles.tabPill}>
                <Text style={styles.tabPillText}>{totalUnreadDirect}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        {activeTab === 'messages' && (
          <TouchableOpacity
            style={styles.newChatBtn}
            onPress={() => setShowNewChatModal(true)}
            activeOpacity={0.7}
          >
            <UserPlus size={16} color={colors.brand} />
            <Text style={styles.newChatBtnText}>New Chat</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {loading && !refreshing ? (
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
              <View style={[styles.whisperCard, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }]}>
                <View style={styles.whisperHeader}>
                  <Text style={styles.whisperBadge}>🤫 Anonymous Whisper</Text>
                  <TouchableOpacity onPress={() => handleDelete(item.id)}>
                    <Trash2 size={16} color={themeColors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.whisperContent, { backgroundColor: themeColors.surfaceBorder, color: themeColors.text }]}>
                  "{item.content}"
                </Text>

                <View style={styles.whisperFooter}>
                  <View style={styles.anonymousTag}>
                    <ShieldCheck size={14} color="#059669" />
                    <Text style={styles.anonymousTagText}>Sender Hidden</Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.shareBtn, { backgroundColor: themeColors.surfaceBorder }]}
                    onPress={() => handleShareWhisper(item)}
                  >
                    <Share2 size={14} color={themeColors.text} />
                    <Text style={[styles.shareText, { color: themeColors.text }]}>Share</Text>
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
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.brand} />
            }
            renderItem={({ item }) => {
              const partner = item.user_a?.id === currentUserId ? item.user_b : item.user_a
              const unread = unreadCounts[item.id] || 0
              const partnerName = partner?.display_name || partner?.username || 'User'
              const avatar = partner?.avatar_url
              const isVoiceNote = item.last_message?.includes('Voice note')

              return (
                <TouchableOpacity
                  style={[
                    styles.convCard,
                    {
                      backgroundColor: themeColors.surface,
                      borderColor: unread > 0 ? colors.brand : themeColors.surfaceBorder,
                    },
                    unread > 0 && styles.convCardUnread,
                  ]}
                  onPress={() => openChat(item)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.avatarCircle, { backgroundColor: colors.brandLight }]}>
                    {avatar ? (
                      <Image source={{ uri: avatar }} style={styles.avatarImg} />
                    ) : (
                      <Text style={styles.avatarText}>{partnerName.charAt(0).toUpperCase()}</Text>
                    )}
                  </View>

                  <View style={styles.convInfo}>
                    <View style={styles.convTopRow}>
                      <Text
                        style={[
                          styles.convName,
                          { color: themeColors.text },
                          unread > 0 && styles.convNameUnread,
                        ]}
                        numberOfLines={1}
                      >
                        {partnerName}
                      </Text>
                      <Text style={[styles.convTime, { color: themeColors.textSecondary }]}>
                        {formatTime(item.last_message_at || item.created_at)}
                      </Text>
                    </View>

                    <View style={styles.convBottomRow}>
                      <Text
                        style={[
                          styles.convMsg,
                          { color: isVoiceNote ? colors.brand : unread > 0 ? themeColors.text : themeColors.textSecondary },
                          unread > 0 && styles.convMsgUnread,
                        ]}
                        numberOfLines={1}
                      >
                        {item.last_message || 'Tap to start chatting'}
                      </Text>

                      {unread > 0 && (
                        <View style={styles.unreadBadge}>
                          <Text style={styles.unreadBadgeText}>{unread}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              )
            }}
          />
        )
      )}

      {/* 1-on-1 Chat Modal */}
      {selectedConversation && (
        <ChatModal
          visible={chatModalVisible}
          conversationId={selectedConversation.id}
          partner={selectedConversation.partner}
          currentUserId={currentUserId || ''}
          onClose={handleCloseChat}
        />
      )}

      {/* New Chat Search Modal */}
      <Modal visible={showNewChatModal} animationType="slide" transparent={true} onRequestClose={() => setShowNewChatModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: themeColors.text }]}>New Direct Message</Text>
              <TouchableOpacity onPress={() => setShowNewChatModal(false)} style={styles.closeBtn}>
                <X size={20} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={[styles.searchBar, { backgroundColor: themeColors.surfaceBorder }]}>
              <Search size={18} color={themeColors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: themeColors.text }]}
                placeholder="Search user by name or @username..."
                placeholderTextColor={themeColors.textSecondary}
                value={searchQuery}
                onChangeText={handleSearchUsers}
                autoFocus
              />
            </View>

            {searching ? (
              <ActivityIndicator color={colors.brand} style={{ marginVertical: 20 }} />
            ) : searchResults.length === 0 ? (
              <Text style={[styles.noSearchText, { color: themeColors.textSecondary }]}>
                {searchQuery.trim() ? 'No users found matching query.' : 'Type a username or display name to search.'}
              </Text>
            ) : (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id}
                style={{ maxHeight: 300, marginVertical: 10 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.searchResultItem, { borderBottomColor: themeColors.surfaceBorder }]}
                    onPress={() => handleStartNewChat(item)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.avatarCircle, { backgroundColor: colors.brandLight }]}>
                      {item.avatar_url ? (
                        <Image source={{ uri: item.avatar_url }} style={styles.avatarImg} />
                      ) : (
                        <Text style={styles.avatarText}>{(item.display_name || item.username).charAt(0).toUpperCase()}</Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.searchResultName, { color: themeColors.text }]}>{item.display_name || item.username}</Text>
                      <Text style={[styles.searchResultHandle, { color: themeColors.textSecondary }]}>@{item.username}</Text>
                    </View>
                    <Text style={styles.chatStartText}>Chat</Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
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
  tabBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabPill: {
    backgroundColor: colors.brand,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  tabPillText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
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
  whisperContent: {
    fontSize: 15,
    fontStyle: 'italic',
    color: colors.gray900,
    backgroundColor: colors.gray50,
    padding: 12,
    borderRadius: 10,
  },
  whisperFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  anonymousTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  anonymousTagText: { fontSize: 11, color: '#059669', fontWeight: '600' },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.gray100,
    borderRadius: 8,
  },
  shareText: { fontSize: 12, fontWeight: '600', color: colors.gray700 },
  convCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  convCardUnread: {
    borderColor: colors.brandLight,
    backgroundColor: '#fdfcfe',
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 46,
    height: 46,
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.brand },
  convInfo: { flex: 1 },
  convTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  convName: { fontSize: 15, fontWeight: '600', color: colors.gray900, flex: 1, marginRight: 8 },
  convNameUnread: { fontWeight: '700', color: colors.gray900 },
  convTime: { fontSize: 11, color: colors.gray400 },
  convBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  convMsg: { fontSize: 13, color: colors.gray500, flex: 1, marginRight: 8 },
  convMsgUnread: { color: colors.gray900, fontWeight: '600' },
  unreadBadge: {
    backgroundColor: colors.brand,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.brandLight,
  },
  newChatBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.brand,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gray900,
  },
  closeBtn: {
    padding: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray100,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: colors.gray900,
  },
  noSearchText: {
    textAlign: 'center',
    color: colors.gray500,
    fontSize: 14,
    marginVertical: 24,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
    gap: 12,
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray900,
  },
  searchResultHandle: {
    fontSize: 12,
    color: colors.gray500,
  },
  chatStartText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.brand,
  },
})
