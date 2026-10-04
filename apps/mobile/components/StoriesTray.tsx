import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native'
import { Plus, X, Eye } from 'lucide-react-native'
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
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([])
  const [activeStoryGroup, setActiveStoryGroup] = useState<StoryGroup | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id)
    })
    fetchStories()
  }, [])

  async function fetchStories() {
    const now = new Date().toISOString()
    const { data: stories } = await supabase
      .from('stories')
      .select('*, author:profiles!stories_author_id_fkey(id, username, display_name, avatar_url)')
      .gt('expires_at', now)
      .order('created_at', { ascending: false })

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

  async function sendReaction(emoji: string) {
    if (!currentUserId || !activeStoryGroup) return
    const authorId = activeStoryGroup.author.id
    if (currentUserId === authorId) return

    try {
      // Find or create conversation
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
        {/* Story Groups */}
        {storyGroups.map((group) => (
          <TouchableOpacity
            key={group.author.id}
            style={styles.storyItem}
            onPress={() => openStoryGroup(group)}
          >
            <View style={styles.ring}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>
                  {group.author.displayName.charAt(0).toUpperCase()}
                </Text>
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
              <View style={styles.progressRow}>
                {activeStoryGroup.stories.map((s, idx) => (
                  <View
                    key={s.id}
                    style={[styles.progressBar, idx <= currentIndex && styles.progressActive]}
                  />
                ))}
              </View>

              <View style={styles.viewerHeader}>
                <Text style={styles.viewerAuthor}>{activeStoryGroup.author.displayName}</Text>
                <TouchableOpacity onPress={() => setActiveStoryGroup(null)}>
                  <X size={20} color="#fff" />
                </TouchableOpacity>
              </View>

              <View style={styles.storyBody}>
                {currentStory.media_url && (
                  <Image
                    source={{ uri: currentStory.media_url }}
                    style={styles.storyImage}
                    resizeMode="cover"
                  />
                )}
                {currentStory.content && (
                  <Text style={styles.storyText}>
                    "{currentStory.content}"
                  </Text>
                )}
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
                    <Text style={styles.ownerViewsText}>Story active (Views tracked)</Text>
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
  container: { backgroundColor: '#fff', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.gray200 },
  scroll: { paddingHorizontal: 16, gap: 14 },
  storyItem: { alignItems: 'center', width: 64 },
  ring: { width: 58, height: 58, borderRadius: 29, padding: 2, backgroundColor: colors.brand },
  avatarCircle: { flex: 1, borderRadius: 27, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: colors.brand },
  authorName: { fontSize: 11, color: colors.gray700, marginTop: 4, textAlign: 'center' },
  viewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  viewerBox: { width: '100%', height: 520, backgroundColor: '#0f172a', borderRadius: 24, padding: 20, justifyContent: 'space-between' },
  progressRow: { flexDirection: 'row', gap: 4 },
  progressBar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' },
  progressActive: { backgroundColor: '#ffffff' },
  viewerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  viewerAuthor: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  storyBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, marginVertical: 12 },
  storyImage: { width: '100%', height: 260, borderRadius: 16, marginBottom: 12 },
  storyText: { color: '#ffffff', fontSize: 16, fontWeight: '600', textAlign: 'center', lineHeight: 24, backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 12 },
  viewerFooter: { marginTop: 8, alignItems: 'center' },
  reactionBar: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 24 },
  reactionBtn: { padding: 6 },
  reactionEmoji: { fontSize: 22 },
  ownerViewsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, opacity: 0.8 },
  ownerViewsText: { color: '#94a3b8', fontSize: 12, fontWeight: '500' },
})
