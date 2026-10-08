import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native'
import { Users, Plus, Hash, Check, X } from 'lucide-react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'
import { colors } from '../constants/colors'
import { useTheme } from '../context/ThemeContext'

export default function CommunitiesScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { colors: themeColors } = useTheme()
  const [communities, setCommunities] = useState<any[]>([])
  const [joinedIds, setJoinedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [creating, setCreating] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }: any) => {
      if (data?.user) setCurrentUserId(data.user.id)
    })
  }, [])

  const fetchCommunities = useCallback(async () => {
    setLoading(true)
    const { data: comms } = await supabase
      .from('communities')
      .select('*')
      .order('created_at', { ascending: false })

    setCommunities(comms ?? [])

    if (currentUserId) {
      const { data: memberships } = await supabase
        .from('community_members')
        .select('community_id')
        .eq('user_id', currentUserId)

      setJoinedIds((memberships ?? []).map((m: any) => m.community_id))
    }
    setLoading(false)
    setRefreshing(false)
  }, [currentUserId])

  useEffect(() => {
    fetchCommunities()
  }, [fetchCommunities])

  function handleRefresh() {
    setRefreshing(true)
    fetchCommunities()
  }

  async function handleToggleJoin(communityId: string) {
    if (!currentUserId) return
    const isJoined = joinedIds.includes(communityId)

    if (isJoined) {
      setJoinedIds((prev) => prev.filter((id) => id !== communityId))
      await supabase
        .from('community_members')
        .delete()
        .match({ community_id: communityId, user_id: currentUserId })
    } else {
      setJoinedIds((prev) => [...prev, communityId])
      await supabase
        .from('community_members')
        .insert({ community_id: communityId, user_id: currentUserId })
    }
  }

  async function handleCreate() {
    if (!name.trim() || !currentUserId) return
    setCreating(true)

    const slug = name.toLowerCase().trim().replace(/[^a-z0-9]/g, '-')

    const { data: created, error } = await supabase
      .from('communities')
      .insert({
        name: name.trim(),
        slug,
        description: description.trim() || null,
        cover_url: coverUrl.trim() || null,
        creator_id: currentUserId,
      })
      .select()
      .single()

    setCreating(false)

    if (error) {
      Alert.alert('Error', error.message)
    } else if (created) {
      await supabase.from('community_members').insert({
        community_id: created.id,
        user_id: currentUserId,
        role: 'owner',
      })

      setName('')
      setDescription('')
      setCoverUrl('')
      setShowCreateModal(false)
      fetchCommunities()
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Top Action Bar */}
      <View style={[styles.header, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.surfaceBorder, paddingTop: insets.top + 10 }]}>
        <View style={styles.headerInfo}>
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>Communities</Text>
          <Text style={[styles.subtitle, { color: themeColors.textMuted }]}>Discover & join topic groups</Text>
        </View>

        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => setShowCreateModal(true)}
        >
          <Plus size={16} color="#fff" />
          <Text style={styles.createBtnText}>Create</Text>
        </TouchableOpacity>
      </View>

      {/* Communities List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.brand} size="large" />
        </View>
      ) : communities.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>👥</Text>
          <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>No Communities Yet</Text>
          <Text style={[styles.emptyBody, { color: themeColors.textMuted }]}>
            Be the first to create a topic community for Photography, Programming, Anime, or Campus Life!
          </Text>
        </View>
      ) : (
        <FlatList
          data={communities}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.brand} />
          }
          renderItem={({ item }) => {
            const isJoined = joinedIds.includes(item.id)
            return (
              <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }]}>
                <TouchableOpacity
                  style={styles.cardHeader}
                  onPress={() => router.push(`/community/${item.slug}` as any)}
                  activeOpacity={0.7}
                >
                  <View style={styles.iconBox}>
                    <Hash size={20} color={colors.brand} />
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={[styles.commName, { color: themeColors.textPrimary }]}>{item.name}</Text>
                    <Text style={[styles.commDesc, { color: themeColors.textSecondary }]} numberOfLines={2}>
                      {item.description || 'Topic community'}
                    </Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[styles.joinBtn, isJoined && styles.joinedBtn, { flex: 1 }]}
                    onPress={() => handleToggleJoin(item.id)}
                  >
                    {isJoined ? (
                      <View style={styles.btnRow}>
                        <Check size={14} color={colors.gray700} />
                        <Text style={styles.joinedText}>Joined</Text>
                      </View>
                    ) : (
                      <View style={styles.btnRow}>
                        <Plus size={14} color="#fff" />
                        <Text style={styles.joinText}>Join</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.viewBtn}
                    onPress={() => router.push(`/community/${item.slug}` as any)}
                  >
                    <Text style={styles.viewBtnText}>View</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )
          }}
        />
      )}

      {/* Create Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create a Community</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <X size={20} color={colors.gray500} />
              </TouchableOpacity>
            </View>

            <View style={styles.form}>
              <Text style={styles.label}>Community Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Photography, Campus Life, Anime"
                placeholderTextColor={colors.gray400}
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.descInput]}
                multiline
                placeholder="What is this community about?"
                placeholderTextColor={colors.gray400}
                value={description}
                onChangeText={setDescription}
              />

              <Text style={styles.label}>Cover Image URL (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="https://images.unsplash.com/..."
                placeholderTextColor={colors.gray400}
                value={coverUrl}
                onChangeText={setCoverUrl}
              />

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setShowCreateModal(false)}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.submitBtn, (!name.trim() || creating) && styles.disabledBtn]}
                  onPress={handleCreate}
                  disabled={!name.trim() || creating}
                >
                  {creating ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.submitText}>Create</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  headerInfo: { flex: 1 },
  title: { fontSize: 18, fontWeight: '700', color: colors.gray900 },
  subtitle: { fontSize: 12, color: colors.gray500, marginTop: 2 },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.brand,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  createBtnText: { color: '#ffffff', fontWeight: '600', fontSize: 13 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.gray900, marginBottom: 8 },
  emptyBody: { fontSize: 14, color: colors.gray500, textAlign: 'center', lineHeight: 20 },
  listContent: { padding: 16, paddingBottom: 100 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.gray200,
    gap: 12,
  },
  cardHeader: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: { flex: 1 },
  commName: { fontSize: 16, fontWeight: '700', color: colors.gray900 },
  commDesc: { fontSize: 13, color: colors.gray500, marginTop: 2 },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  joinBtn: {
    backgroundColor: colors.brand,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  joinedBtn: { backgroundColor: colors.gray100, borderWidth: 1, borderColor: colors.gray300 },
  viewBtn: {
    backgroundColor: colors.brandLight,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.brand,
  },
  viewBtnText: {
    color: colors.brand,
    fontWeight: '700',
    fontSize: 13,
  },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  joinText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  joinedText: { color: colors.gray700, fontWeight: '600', fontSize: 13 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.gray900 },
  form: { gap: 12 },
  label: { fontSize: 13, fontWeight: '600', color: colors.gray700 },
  input: { borderWidth: 1, borderColor: colors.gray300, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: colors.gray900 },
  descInput: { minHeight: 80, textAlignVertical: 'top' },
  modalFooter: { flexDirection: 'row', gap: 12, paddingTop: 12 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: colors.gray300, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  cancelText: { fontSize: 14, fontWeight: '600', color: colors.gray700 },
  submitBtn: { flex: 1, backgroundColor: colors.brand, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  disabledBtn: { opacity: 0.5 },
  submitText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
})
