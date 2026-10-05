import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  TouchableWithoutFeedback,
} from 'react-native'
import { Plus, X, Eye, ChevronLeft, ChevronRight } from 'lucide-react-native'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { colors } from '../constants/colors'

interface StoryGroup {
  author: {
    id: string
    username: string
    displayName: string
    avatarUrl: string | null
  }
  stories: any[]
}

export function StoriesTray() {
  const router = useRouter()
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([])
  const [activeStoryGroup, setActiveStoryGroup] = useState<StoryGroup | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setCurrentUserId(data.user.id)
        fetchUserAvatar(data.user.id)
      }
    })
    fetchStories()
  }, [])

  async function fetchUserAvatar(uId: string) {
    const { data } = await supabase.from('profiles').select('avatar_url').eq('id', uId).maybeSingle()
    if (data?.avatar_url) setUserAvatarUrl(data.avatar_url)
  }

  async function fetchStories() {
    const now = new Date().toISOString()
    const { data: stories } = await supabase
      .from('stories')
      .select('*, author:profiles!stories_author_id_fkey(id, username, display_name, avatar_url)')
      .gt('expires_at', now)
      .order('created_at', { ascending: true })

    if (stories) {
      const authorMap = new Map<string, StoryGroup>()
      for (const story of stories) {
        const authorId = story.author_id
        if (!authorMap.has(authorId)) {
          authorMap.set(authorId, {
            author: {
              id: story.author?.id || story.author_id,
              username: story.author?.username || 'user',
              displayName: story.author?.display_name || 'User',
              avatarUrl: story.author?.avatar_url || null,
            },
            stories: [],
          })
        }
        authorMap.get(authorId)!.stories.push(story)
      }
      setStoryGroups(Array.from(authorMap.values()))
    }
  }

  function openStoryGroup(group: StoryGroup) {
    setActiveStoryGroup(group)
    setCurrentIndex(0)
  }

  function handleNextStory() {
    if (!activeStoryGroup) return
    if (currentIndex < activeStoryGroup.stories.length - 1) {
      setCurrentIndex((prev) => prev + 1)
    } else {
      setActiveStoryGroup(null)
    }
  }

  function handlePrevStory() {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1)
    }
  }

  async function sendReaction(emoji: string) {
    if (!currentUserId || !activeStoryGroup) return
    const authorId = activeStoryGroup.author.id
    if (currentUserId === authorId) return

    try {
      let { data: conv } = await supabase
        .from('conversations')
        .select('id')
        .or(`and(user_a_id.eq.${currentUserId},user_b_id.eq.${authorId}),and(user_a_id.eq.${authorId},user_b_id.eq.${currentUserId})`)
        .maybeSingle()

      if (!conv) {
        const sorted = [currentUserId, authorId].sort()
        const { data: newConv, error: convErr } = await supabase
          .from('conversations')
          .insert({ user_a_id: sorted[0], user_b_id: sorted[1] })
          .select('id')
          .single()
        if (convErr) throw convErr
        conv = newConv
      }

      if (conv) {
        await supabase.from('messages').insert({
          conversation_id: conv.id,
          sender_id: currentUserId,
          content: `Reacted ${emoji} to your story`,
        })
        Alert.alert('Sent', `Reacted ${emoji} to ${activeStoryGroup.author.displayName}`)
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to send reaction')
    }
  }

  const currentStory = activeStoryGroup?.stories[currentIndex]
  const isOwner = currentUserId && activeStoryGroup?.author.id === currentUserId

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Your Story (+) Add Button */}
        <TouchableOpacity
          style={styles.storyItem}
          onPress={() => router.push('/create?type=story' as any)}
        >
          <View style={styles.addRing}>
            {userAvatarUrl ? (
              <Image source={{ uri: userAvatarUrl }} style={styles.addAvatarImg} />
            ) : (
              <View style={styles.addAvatarPlaceholder}>
                <Text style={styles.addAvatarText}>You</Text>
              </View>
            )}
            <View style={styles.plusBadge}>
              <Plus size={12} color="#ffffff" strokeWidth={3} />
            </View>
          </View>
          <Text style={styles.authorName} numberOfLines={1}>Your Story</Text>
        </TouchableOpacity>

        {/* Story Groups */}
        {storyGroups.map((group) => (
          <TouchableOpacity
            key={group.author.id}
            style={styles.storyItem}
            onPress={() => openStoryGroup(group)}
          >
            <View style={styles.ring}>
              <View style={styles.avatarCircle}>
                {group.author.avatarUrl ? (
                  <Image source={{ uri: group.author.avatarUrl }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarText}>
                    {group.author.displayName.charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
            </View>
            <Text style={styles.authorName} numberOfLines={1}>
              {group.author.displayName}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Full-Screen Story Viewer */}
      {activeStoryGroup && currentStory && (
        <Modal visible animationType="fade" transparent>
          <View style={styles.viewerOverlay}>
            <View style={styles.viewerBox}>
              {/* Progress bars */}
              <View style={styles.progressRow}>
                {activeStoryGroup.stories.map((s, idx) => (
                  <View
                    key={s.id}
                    style={[styles.progressBar, idx <= currentIndex && styles.progressActive]}
                  />
                ))}
              </View>

              {/* Story Header */}
              <View style={styles.viewerHeader}>
                <View style={styles.headerAuthorInfo}>
                  <View style={styles.miniAvatarCircle}>
                    {activeStoryGroup.author.avatarUrl ? (
                      <Image source={{ uri: activeStoryGroup.author.avatarUrl }} style={styles.miniAvatarImg} />
                    ) : (
                      <Text style={styles.miniAvatarText}>{activeStoryGroup.author.displayName.charAt(0)}</Text>
                    )}
                  </View>
                  <Text style={styles.viewerAuthor}>{activeStoryGroup.author.displayName}</Text>
                </View>
                <TouchableOpacity onPress={() => setActiveStoryGroup(null)} style={styles.closeBtn}>
                  <X size={20} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Story Content View Area (Tappable Left/Right) */}
              <View style={styles.storyBodyContainer}>
                <TouchableWithoutFeedback onPress={handlePrevStory}>
                  <View style={styles.touchLeft} />
                </TouchableWithoutFeedback>
                <TouchableWithoutFeedback onPress={handleNextStory}>
                  <View style={styles.touchRight} />
                </TouchableWithoutFeedback>

                <View style={styles.storyContentCenter} pointerEvents="none">
                  {currentStory.media_url && (
                    <Image
                      source={{ uri: currentStory.media_url }}
                      style={styles.storyImage}
                      contentFit="cover"
                    />
                  )}
                  {currentStory.content && (
                    <Text style={styles.storyText}>
                      {currentStory.content}
                    </Text>
                  )}
                </View>
              </View>

              {/* Reaction Bar & Footer */}
              <View style={styles.viewerFooter}>
                {!isOwner ? (
                  <View style={styles.reactionBar}>
                    {['❤️', '🔥', '👏', '😂', '😮', '😍'].map((emoji) => (
                      <TouchableOpacity
                        key={emoji}
                        style={styles.reactionBtn}
                        onPress={() => sendReaction(emoji)}
                      >
                        <Text style={styles.reactionEmoji}>{emoji}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <View style={styles.ownerViewsRow}>
                    <Eye size={16} color="#94a3b8" />
                    <Text style={styles.ownerViewsText}>Story active • 24h expiration</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.gray200 },
  scroll: { paddingHorizontal: 16, gap: 14 },
  storyItem: { alignItems: 'center', width: 62 },
  addRing: { width: 56, height: 56, borderRadius: 28, position: 'relative' },
  addAvatarImg: { width: 56, height: 56, borderRadius: 28 },
  addAvatarPlaceholder: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center' },
  addAvatarText: { fontSize: 13, fontWeight: '700', color: colors.brand },
  plusBadge: { position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.brand, borderWidth: 2, borderColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },

  ring: { width: 56, height: 56, borderRadius: 28, padding: 2, backgroundColor: colors.brand },
  avatarCircle: { flex: 1, borderRadius: 26, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.brand },
  authorName: { fontSize: 11, color: colors.gray700, marginTop: 4, textAlign: 'center' },

  viewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  viewerBox: { width: '100%', height: 540, backgroundColor: '#0f172a', borderRadius: 24, padding: 18, justifyContent: 'space-between' },
  progressRow: { flexDirection: 'row', gap: 4 },
  progressBar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' },
  progressActive: { backgroundColor: '#ffffff' },

  viewerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  headerAuthorInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  miniAvatarCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  miniAvatarImg: { width: 30, height: 30 },
  miniAvatarText: { fontSize: 13, fontWeight: '700', color: colors.brand },
  viewerAuthor: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  closeBtn: { padding: 4 },

  storyBodyContainer: { flex: 1, position: 'relative', marginVertical: 12, justifyContent: 'center', alignItems: 'center' },
  touchLeft: { position: 'absolute', top: 0, left: 0, bottom: 0, width: '40%', zIndex: 10 },
  touchRight: { position: 'absolute', top: 0, right: 0, bottom: 0, width: '60%', zIndex: 10 },
  storyContentCenter: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  storyImage: { width: '100%', height: 300, borderRadius: 16, marginBottom: 12 },
  storyText: { color: '#ffffff', fontSize: 16, fontWeight: '600', textAlign: 'center', lineHeight: 24, backgroundColor: 'rgba(0,0,0,0.6)', padding: 14, borderRadius: 14 },

  viewerFooter: { marginTop: 4, alignItems: 'center' },
  reactionBar: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 24 },
  reactionBtn: { padding: 6 },
  reactionEmoji: { fontSize: 22 },
  ownerViewsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, opacity: 0.8 },
  ownerViewsText: { color: '#94a3b8', fontSize: 12, fontWeight: '500' },
})
