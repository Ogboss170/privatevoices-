import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import {
  Search,
  Users,
  User,
  Hash,
  X,
  Sparkles,
  MessageSquare,
  ArrowRight,
  Flame,
} from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { supabase } from '../../lib/supabase'
import { colors } from '../../constants/colors'
import { PublicProfileModal } from '../../components/PublicProfileModal'
import { MobilePostCard } from '../../components/MobilePostCard'
import type { Post } from '@private-voices/shared'
import { extractPostMediaAndCleanContent } from '@private-voices/shared'
import { useTheme } from '../../context/ThemeContext'

type SearchTab = 'all' | 'voices' | 'people' | 'communities'

export default function ExploreScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { colors: themeColors } = useTheme()
  const params = useLocalSearchParams<{ q?: string; tab?: string }>()

  const [searchTerm, setSearchTerm] = useState(params.q || '')
  const [activeTab, setActiveTab] = useState<SearchTab>((params.tab as SearchTab) || 'all')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Data states
  const [profiles, setProfiles] = useState<any[]>([])
  const [voices, setVoices] = useState<Post[]>([])
  const [communities, setCommunities] = useState<any[]>([])
  const [hashtags, setHashtags] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // Profile modal
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [profileModalVisible, setProfileModalVisible] = useState(false)

  // Update query/tab when route params change (e.g. tapping #hashtag in MobilePostCard)
  useEffect(() => {
    if (params.q !== undefined) {
      setSearchTerm(params.q)
    }
    if (params.tab && ['all', 'voices', 'people', 'communities'].includes(params.tab)) {
      setActiveTab(params.tab as SearchTab)
    }
  }, [params.q, params.tab])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id)
    })
  }, [])

  // Format post data into Post interface
  const formatPosts = useCallback(
    async (postsData: any[]): Promise<Post[]> => {
      if (!postsData || postsData.length === 0) return []

      const authorIds = Array.from(new Set(postsData.map((p) => p.author_id)))
      const { data: profList } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', authorIds)

      const profileMap = new Map((profList ?? []).map((prof) => [prof.id, prof]))

      return Promise.all(
        postsData.map(async (p) => {
          let likeCount = 0
          let commentCount = 0

          try {
            const [{ count: lCount }, { count: cCount }] = await Promise.all([
              supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
              supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
            ])
            likeCount = lCount ?? 0
            commentCount = cCount ?? 0
          } catch {
            // ignore
          }

          let isLikedByMe = false
          let isSavedByMe = false

          if (currentUserId) {
            try {
              const [{ data: like }, { data: save }] = await Promise.all([
                supabase.from('likes').select('user_id').match({ user_id: currentUserId, post_id: p.id }).maybeSingle(),
                supabase.from('saved_posts').select('user_id').match({ user_id: currentUserId, post_id: p.id }).maybeSingle(),
              ])
              isLikedByMe = !!like
              isSavedByMe = !!save
            } catch {
              // ignore
            }
          }

          const authorData = p.author || profileMap.get(p.author_id)
          const { content: cleanContent, imageUrls } = extractPostMediaAndCleanContent(p.content, p.image_urls)

          return {
            id: p.id,
            authorId: p.author_id,
            author: {
              id: authorData?.id || p.author_id,
              username: authorData?.username || 'user',
              displayName: authorData?.display_name || 'User',
              avatarUrl: authorData?.avatar_url || null,
            },
            content: cleanContent,
            imageUrls,
            hashtags: [],
            likeCount,
            commentCount,
            repostCount: 0,
            isLikedByMe,
            isSavedByMe,
            isRepostedByMe: false,
            createdAt: p.created_at,
            updatedAt: p.updated_at,
          }
        })
      )
    },
    [currentUserId]
  )

  // Execute Search query
  const executeSearch = useCallback(
    async (term: string, tab: SearchTab) => {
      setLoading(true)
      const cleanTerm = term.trim()

      try {
        // Fetch trending hashtags ordered by count/activity with curated fallback
        let { data: tagData } = await supabase
          .from('hashtags')
          .select('*')
          .order('post_count', { ascending: false })
          .limit(10)

        if (!tagData || tagData.length === 0) {
          tagData = [
            { id: '1', name: 'PrivateVoices', post_count: 142 },
            { id: '2', name: 'AnonymousWhisper', post_count: 98 },
            { id: '3', name: 'TechTalk', post_count: 75 },
            { id: '4', name: 'CampusLife', post_count: 64 },
            { id: '5', name: 'DesignSystem', post_count: 52 },
            { id: '6', name: 'GamingCommunity', post_count: 41 },
            { id: '7', name: 'WebDevelopment', post_count: 38 },
          ]
        }
        setHashtags(tagData)

        if (!cleanTerm) {
          // Explore discovery mode
          const [{ data: profs }, { data: comms }, { data: recentPosts }] = await Promise.all([
            supabase.from('profiles').select('*').limit(6),
            supabase.from('communities').select('*').limit(6),
            supabase.from('posts').select('*').order('created_at', { ascending: false }).limit(6),
          ])

          setProfiles(profs ?? [])
          setCommunities(comms ?? [])
          const formatted = await formatPosts(recentPosts ?? [])
          setVoices(formatted)
        } else {
          // Active Search mode
          const isHashtagSearch = cleanTerm.startsWith('#')
          const keyword = isHashtagSearch ? cleanTerm.slice(1).trim() : cleanTerm

          // Fetch matching People
          if (tab === 'all' || tab === 'people') {
            const { data: matchedProfiles } = await supabase
              .from('profiles')
              .select('*')
              .or(`username.ilike.%${keyword}%,display_name.ilike.%${keyword}%,bio.ilike.%${keyword}%`)
              .limit(tab === 'people' ? 20 : 4)
            setProfiles(matchedProfiles ?? [])
          } else {
            setProfiles([])
          }

          // Fetch matching Communities
          if (tab === 'all' || tab === 'communities') {
            const { data: matchedCommunities } = await supabase
              .from('communities')
              .select('*')
              .or(`name.ilike.%${keyword}%,slug.ilike.%${keyword}%,description.ilike.%${keyword}%`)
              .limit(tab === 'communities' ? 20 : 4)
            setCommunities(matchedCommunities ?? [])
          } else {
            setCommunities([])
          }

          // Fetch matching Voices
          if (tab === 'all' || tab === 'voices') {
            let postsQuery = supabase.from('posts').select('*')
            if (isHashtagSearch) {
              postsQuery = postsQuery.or(`content.ilike.%#${keyword}%,content.ilike.%${keyword}%`)
            } else {
              postsQuery = postsQuery.ilike('content', `%${keyword}%`)
            }

            const { data: matchedPosts } = await postsQuery
              .order('created_at', { ascending: false })
              .limit(tab === 'voices' ? 20 : 5)

            const formatted = await formatPosts(matchedPosts ?? [])
            setVoices(formatted)
          } else {
            setVoices([])
          }
        }
      } catch (err) {
        console.error('Mobile explore search error:', err)
      } finally {
        setLoading(false)
      }
    },
    [formatPosts]
  )

  useEffect(() => {
    executeSearch(searchTerm, activeTab)
  }, [searchTerm, activeTab, executeSearch])

  function handleTagPress(tagName: string) {
    const query = `#${tagName}`
    setSearchTerm(query)
    setActiveTab('voices')
    router.setParams({ q: query, tab: 'voices' })
  }

  function handleClearSearch() {
    setSearchTerm('')
    router.setParams({ q: '', tab: activeTab })
  }

  const isSearching = searchTerm.trim().length > 0
  const normalizedSearch = searchTerm.trim().toLowerCase()

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: Math.max(insets.top + 8, 16) },
      ]}
    >
      {/* ── Search Bar ── */}
      <View style={[styles.searchBar, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }]}>
        <Search size={18} color={themeColors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: themeColors.textPrimary }]}
          placeholder="Search people, voices, #hashtags, communities..."
          placeholderTextColor={themeColors.textMuted}
          value={searchTerm}
          onChangeText={(val) => {
            setSearchTerm(val)
            router.setParams({ q: val, tab: activeTab })
          }}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {searchTerm.length > 0 && (
          <TouchableOpacity onPress={handleClearSearch} style={styles.clearBtn}>
            <X size={16} color={themeColors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Trending Hashtags ── */}
      <View style={[styles.hashtagsCard, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }]}>
        <View style={styles.hashtagsHeader}>
          <View style={styles.hashtagsTitleGroup}>
            <Flame size={16} color={colors.brand} />
            <Text style={[styles.hashtagsTitle, { color: themeColors.textPrimary }]}>TRENDING HASHTAGS</Text>
          </View>
          {isSearching && normalizedSearch.startsWith('#') && (
            <TouchableOpacity onPress={handleClearSearch}>
              <Text style={styles.resetFilterText}>Reset filter</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.tagWrap}>
          {hashtags.length === 0 ? (
            <Text style={styles.emptyText}>Discovering trending hashtags...</Text>
          ) : (
            hashtags.map((tag) => {
              const isSelected = normalizedSearch === `#${tag.name.toLowerCase()}`
              return (
                <TouchableOpacity
                  key={tag.id || tag.name}
                  style={[styles.tagPill, isSelected && styles.tagPillSelected]}
                  onPress={() => handleTagPress(tag.name)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tagText, isSelected && styles.tagTextSelected]}>
                    #{tag.name}
                  </Text>
                  {tag.post_count && (
                    <Text style={[styles.tagCountText, isSelected && styles.tagCountTextSelected]}>
                      {tag.post_count}
                    </Text>
                  )}
                </TouchableOpacity>
              )
            })
          )}
        </View>
      </View>

      {/* ── Segmented Multi-Tabs ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabsContainer}
      >
        {[
          { id: 'all', label: 'All', icon: Sparkles },
          { id: 'voices', label: 'Voices', icon: MessageSquare, count: voices.length },
          { id: 'people', label: 'People', icon: User, count: profiles.length },
          { id: 'communities', label: 'Communities', icon: Users, count: communities.length },
        ].map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
              onPress={() => {
                setActiveTab(tab.id as SearchTab)
                router.setParams({ q: searchTerm, tab: tab.id })
              }}
              activeOpacity={0.7}
            >
              <Icon size={14} color={isActive ? colors.brand : colors.gray500} />
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label}
              </Text>
              {isSearching && tab.count !== undefined && tab.count > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{tab.count}</Text>
                </View>
              )}
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* ── Search Results & Feed ── */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand} />
          <Text style={styles.loadingText}>Searching Private Voices...</Text>
        </View>
      ) : (
        <View style={styles.resultsContainer}>
          {/* ════════════════════ TAB: ALL ════════════════════ */}
          {activeTab === 'all' && (
            <>
              {/* People Section */}
              {profiles.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionTitleRow}>
                      <User size={16} color={colors.brand} />
                      <Text style={styles.sectionTitle}>
                        {isSearching ? 'Matching People' : 'People to Discover'}
                      </Text>
                    </View>
                    {isSearching && profiles.length >= 4 && (
                      <TouchableOpacity
                        onPress={() => {
                          setActiveTab('people')
                          router.setParams({ q: searchTerm, tab: 'people' })
                        }}
                      >
                        <Text style={styles.viewAllText}>View all</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.listGap}>
                    {profiles.slice(0, 4).map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.userCard}
                        onPress={() => {
                          setSelectedUserId(item.id)
                          setProfileModalVisible(true)
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.avatarCircle}>
                          {item.avatar_url ? (
                            <Image
                              source={{ uri: item.avatar_url }}
                              style={styles.avatarImg}
                              contentFit="cover"
                            />
                          ) : (
                            <Text style={styles.avatarText}>
                              {item.display_name?.charAt(0).toUpperCase() || 'U'}
                            </Text>
                          )}
                        </View>
                        <View style={styles.userInfo}>
                          <Text style={styles.displayName}>{item.display_name}</Text>
                          <Text style={styles.username}>@{item.username}</Text>
                          {item.bio && (
                            <Text style={styles.bioText} numberOfLines={1}>
                              {item.bio}
                            </Text>
                          )}
                        </View>
                        <Text style={styles.cardActionText}>View</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Communities Section */}
              {communities.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionTitleRow}>
                      <Users size={16} color="#7c3aed" />
                      <Text style={styles.sectionTitle}>
                        {isSearching ? 'Matching Communities' : 'Recommended Communities'}
                      </Text>
                    </View>
                    {isSearching && communities.length >= 4 && (
                      <TouchableOpacity
                        onPress={() => {
                          setActiveTab('communities')
                          router.setParams({ q: searchTerm, tab: 'communities' })
                        }}
                      >
                        <Text style={styles.viewAllText}>View all</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.listGap}>
                    {communities.slice(0, 4).map((comm) => (
                      <TouchableOpacity
                        key={comm.id}
                        style={styles.commCard}
                        onPress={() => router.push(`/community/${comm.slug}` as any)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.avatarCircle, { backgroundColor: '#f3e8ff' }]}>
                          {comm.avatar_url ? (
                            <Image source={{ uri: comm.avatar_url }} style={styles.avatarImg} contentFit="cover" />
                          ) : (
                            <Text style={[styles.avatarText, { color: '#7c3aed' }]}>
                              {comm.name.charAt(0).toUpperCase()}
                            </Text>
                          )}
                        </View>
                        <View style={styles.userInfo}>
                          <Text style={styles.displayName}>{comm.name}</Text>
                          <Text style={styles.username} numberOfLines={1}>
                            c/{comm.slug} • {comm.privacy || 'public'}
                          </Text>
                        </View>
                        <Text style={[styles.cardActionText, { color: '#7c3aed' }]}>View</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Voices Section */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleRow}>
                    <MessageSquare size={16} color={colors.brand} />
                    <Text style={styles.sectionTitle}>
                      {isSearching ? 'Matching Voices' : 'Popular Voices'}
                    </Text>
                  </View>
                  {voices.length > 4 && (
                    <TouchableOpacity
                      onPress={() => {
                        setActiveTab('voices')
                        router.setParams({ q: searchTerm, tab: 'voices' })
                      }}
                    >
                      <Text style={styles.viewAllText}>See all {voices.length}</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {voices.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyTitle}>No matching Voices found</Text>
                    <Text style={styles.emptySubtitle}>
                      Try searching with a broader keyword or tap a trending #hashtag above.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.voicesList}>
                    {voices.map((post) => (
                      <MobilePostCard
                        key={post.id}
                        post={post}
                        currentUserId={currentUserId ?? undefined}
                        onPressAuthor={(userId) => {
                          setSelectedUserId(userId)
                          setProfileModalVisible(true)
                        }}
                        onPressHashtag={(tag) => handleTagPress(tag.replace('#', ''))}
                      />
                    ))}
                  </View>
                )}
              </View>
            </>
          )}

          {/* ════════════════════ TAB: VOICES ════════════════════ */}
          {activeTab === 'voices' && (
            <View style={styles.tabContent}>
              {voices.length === 0 ? (
                <View style={styles.emptyCard}>
                  <MessageSquare size={36} color={colors.gray300} style={styles.emptyIcon} />
                  <Text style={styles.emptyTitle}>No Voices Found</Text>
                  <Text style={styles.emptySubtitle}>
                    We couldn't find any Voices matching "{searchTerm}". Try a different keyword or explore trending hashtags.
                  </Text>
                </View>
              ) : (
                <View style={styles.voicesList}>
                  {voices.map((post) => (
                    <MobilePostCard
                      key={post.id}
                      post={post}
                      currentUserId={currentUserId ?? undefined}
                      onPressAuthor={(userId) => {
                        setSelectedUserId(userId)
                        setProfileModalVisible(true)
                      }}
                      onPressHashtag={(tag) => handleTagPress(tag.replace('#', ''))}
                    />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ════════════════════ TAB: PEOPLE ════════════════════ */}
          {activeTab === 'people' && (
            <View style={styles.tabContent}>
              {profiles.length === 0 ? (
                <View style={styles.emptyCard}>
                  <User size={36} color={colors.gray300} style={styles.emptyIcon} />
                  <Text style={styles.emptyTitle}>No Users Found</Text>
                  <Text style={styles.emptySubtitle}>
                    No people match "{searchTerm}". Try searching by username or display name.
                  </Text>
                </View>
              ) : (
                <View style={styles.listGap}>
                  {profiles.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.userCard}
                      onPress={() => {
                        setSelectedUserId(item.id)
                        setProfileModalVisible(true)
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.avatarCircle}>
                        {item.avatar_url ? (
                          <Image
                            source={{ uri: item.avatar_url }}
                            style={styles.avatarImg}
                            contentFit="cover"
                          />
                        ) : (
                          <Text style={styles.avatarText}>
                            {item.display_name?.charAt(0).toUpperCase() || 'U'}
                          </Text>
                        )}
                      </View>
                      <View style={styles.userInfo}>
                        <Text style={styles.displayName}>{item.display_name}</Text>
                        <Text style={styles.username}>@{item.username}</Text>
                        {item.bio && (
                          <Text style={styles.bioText} numberOfLines={2}>
                            {item.bio}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.cardActionText}>View</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ════════════════════ TAB: COMMUNITIES ════════════════════ */}
          {activeTab === 'communities' && (
            <View style={styles.tabContent}>
              {communities.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Users size={36} color={colors.gray300} style={styles.emptyIcon} />
                  <Text style={styles.emptyTitle}>No Communities Found</Text>
                  <Text style={styles.emptySubtitle}>
                    No communities match "{searchTerm}". Create a community or explore existing ones.
                  </Text>
                </View>
              ) : (
                <View style={styles.listGap}>
                  {communities.map((comm) => (
                    <TouchableOpacity
                      key={comm.id}
                      style={styles.commCard}
                      onPress={() => router.push(`/community/${comm.slug}` as any)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.avatarCircle, { backgroundColor: '#f3e8ff' }]}>
                        {comm.avatar_url ? (
                          <Image source={{ uri: comm.avatar_url }} style={styles.avatarImg} contentFit="cover" />
                        ) : (
                          <Text style={[styles.avatarText, { color: '#7c3aed' }]}>
                            {comm.name.charAt(0).toUpperCase()}
                          </Text>
                        )}
                      </View>
                      <View style={styles.userInfo}>
                        <Text style={styles.displayName}>{comm.name}</Text>
                        <Text style={styles.username}>c/{comm.slug} • {comm.privacy || 'public'}</Text>
                        {comm.description && (
                          <Text style={styles.bioText} numberOfLines={2}>
                            {comm.description}
                          </Text>
                        )}
                      </View>
                      <Text style={[styles.cardActionText, { color: '#7c3aed' }]}>View</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* ── Public Profile Modal ── */}
      {selectedUserId && (
        <PublicProfileModal
          visible={profileModalVisible}
          userId={selectedUserId}
          currentUserId={currentUserId}
          onClose={() => {
            setProfileModalVisible(false)
            setSelectedUserId(null)
          }}
        />
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 110,
    gap: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.gray200,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.gray900,
  },
  clearBtn: {
    padding: 4,
  },
  hashtagsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  hashtagsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hashtagsTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hashtagsTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.brand,
    letterSpacing: 0.5,
  },
  resetFilterText: {
    fontSize: 12,
    color: colors.brand,
    fontWeight: '600',
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagPill: {
    backgroundColor: colors.gray100,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  tagPillSelected: {
    backgroundColor: colors.brand,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gray700,
  },
  tagTextSelected: {
    color: '#ffffff',
  },
  tagCountText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.gray500,
    marginLeft: 4,
  },
  tagCountTextSelected: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  emptyText: {
    fontSize: 12,
    color: colors.gray400,
  },
  tabsScroll: {
    flexGrow: 0,
  },
  tabsContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  tabButtonActive: {
    backgroundColor: colors.brandLight,
    borderColor: colors.brand,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray600,
  },
  tabTextActive: {
    color: colors.brand,
    fontWeight: '700',
  },
  tabBadge: {
    backgroundColor: colors.gray200,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  tabBadgeText: {
    fontSize: 10,
    color: colors.gray700,
    fontWeight: '700',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: colors.gray500,
  },
  resultsContainer: {
    gap: 20,
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.gray900,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.brand,
  },
  listGap: {
    gap: 8,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.brand,
  },
  userInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.gray900,
  },
  username: {
    fontSize: 12,
    color: colors.gray500,
    marginTop: 1,
  },
  bioText: {
    fontSize: 11,
    color: colors.gray500,
    marginTop: 2,
  },
  cardActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.brand,
    paddingHorizontal: 8,
  },
  commCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  commIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voicesList: {
    gap: 12,
  },
  tabContent: {
    gap: 12,
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    textAlign: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  emptyIcon: {
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.gray800,
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.gray500,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
})
