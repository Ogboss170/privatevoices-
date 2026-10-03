import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Search, TrendingUp, Users, User, Hash } from 'lucide-react-native'
import { supabase } from '../../lib/supabase'
import { colors } from '../../constants/colors'
import { PublicProfileModal } from '../../components/PublicProfileModal'

export default function ExploreScreen() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [profiles, setProfiles] = useState<any[]>([])
  const [communities, setCommunities] = useState<any[]>([])
  const [hashtags, setHashtags] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [profileModalVisible, setProfileModalVisible] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id)
    })
    loadExploreData()
  }, [])

  async function loadExploreData() {
    setLoading(true)
    const [{ data: profs }, { data: comms }, { data: tags }] = await Promise.all([
      supabase.from('profiles').select('*').limit(6),
      supabase.from('communities').select('*').limit(6),
      supabase.from('hashtags').select('*').limit(8),
    ])

    setProfiles(profs ?? [])
    setCommunities(comms ?? [])
    setHashtags(tags ?? [])
    setLoading(false)
  }

  async function handleSearch(term: string) {
    setSearchTerm(term)
    if (!term.trim()) return

    const { data: matchedProfiles } = await supabase
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
      .limit(10)

    if (matchedProfiles) setProfiles(matchedProfiles)
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Search size={18} color={colors.gray400} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search people, hashtags, topics..."
          placeholderTextColor={colors.gray400}
          value={searchTerm}
          onChangeText={handleSearch}
        />
      </View>

      {/* Trending Hashtags */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <TrendingUp size={18} color={colors.brand} />
          <Text style={styles.sectionTitle}>Trending Hashtags</Text>
        </View>

        <View style={styles.tagWrap}>
          {hashtags.length === 0 ? (
            <Text style={styles.emptyText}>No hashtags trending yet.</Text>
          ) : (
            hashtags.map((tag) => (
              <TouchableOpacity key={tag.id} style={styles.tagPill}>
                <Text style={styles.tagText}>#{tag.name}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </View>

      {/* Recommended People */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <User size={18} color={colors.gray700} />
          <Text style={styles.sectionTitle}>People to Discover</Text>
        </View>

        <View style={styles.grid}>
          {profiles.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.userCard}
              onPress={() => {
                setSelectedUserId(item.id)
                setProfileModalVisible(true)
              }}
            >
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{item.display_name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.displayName}>{item.display_name}</Text>
                <Text style={styles.username}>@{item.username}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Recommended Communities */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Users size={18} color={colors.gray700} />
          <Text style={styles.sectionTitle}>Recommended Communities</Text>
        </View>

        <View style={styles.grid}>
          {communities.map((comm) => (
            <TouchableOpacity
              key={comm.id}
              style={styles.commCard}
              onPress={() => router.push(`/community/${comm.slug}` as any)}
              activeOpacity={0.7}
            >
              <View style={styles.commIconBox}>
                <Hash size={18} color={colors.brand} />
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.displayName}>{comm.name}</Text>
                <Text style={styles.username} numberOfLines={1}>
                  {comm.description || 'Community'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Public Profile Modal */}
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
  container: { flex: 1, backgroundColor: colors.gray50 },
  scrollContent: { padding: 16, paddingBottom: 100, gap: 20 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.gray900 },
  section: { gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.gray900 },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagPill: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  tagText: { fontSize: 13, fontWeight: '600', color: colors.brand },
  emptyText: { fontSize: 13, color: colors.gray400 },
  grid: { gap: 8 },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: colors.brand },
  userInfo: { flex: 1 },
  displayName: { fontSize: 14, fontWeight: '700', color: colors.gray900 },
  username: { fontSize: 12, color: colors.gray500, marginTop: 1 },
  commCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  commIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
