import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native'
import { Edit3, Lock, LogOut } from 'lucide-react-native'
import { supabase } from '../../lib/supabase'
import { colors } from '../../constants/colors'
import { EditProfileModal } from '../../components/EditProfileModal'
import type { User } from '@supabase/supabase-js'

export default function ProfileScreen() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<{
    display_name: string
    username: string
    bio: string | null
    avatar_url: string | null
    is_private: boolean
  } | null>(null)
  const [stats, setStats] = useState({ followerCount: 0, followingCount: 0, postCount: 0 })
  const [loading, setLoading] = useState(true)
  const [editModalVisible, setEditModalVisible] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      if (data.user) fetchProfileData(data.user.id)
    })
  }, [])

  async function fetchProfileData(userId: string) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('display_name, username, bio, avatar_url, is_private')
      .eq('id', userId)
      .single()

    const [{ count: followerCount }, { count: followingCount }, { count: postCount }] = await Promise.all([
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
      supabase.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', userId),
    ])

    setProfile(prof)
    setStats({
      followerCount: followerCount ?? 0,
      followingCount: followingCount ?? 0,
      postCount: postCount ?? 0,
    })
    setLoading(false)
  }

  function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => supabase.auth.signOut(),
      },
    ])
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.brand} size="large" />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Avatar */}
      <View style={styles.avatarCircle}>
        <Text style={styles.avatarLetter}>
          {profile?.display_name?.charAt(0)?.toUpperCase() ?? '?'}
        </Text>
      </View>

      {/* Name & Username */}
      <View style={styles.nameGroup}>
        <View style={styles.row}>
          <Text style={styles.displayName}>{profile?.display_name}</Text>
          {profile?.is_private && <Lock size={16} color={colors.brand} />}
        </View>
        <Text style={styles.username}>@{profile?.username}</Text>
      </View>

      {/* Bio */}
      {profile?.bio && <Text style={styles.bio}>{profile.bio}</Text>}

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{stats.postCount}</Text>
          <Text style={styles.statLabel}>posts</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{stats.followerCount}</Text>
          <Text style={styles.statLabel}>followers</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>{stats.followingCount}</Text>
          <Text style={styles.statLabel}>following</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => setEditModalVisible(true)}
        >
          <Edit3 size={16} color={colors.gray800} />
          <Text style={styles.editBtnText}>Edit Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <LogOut size={16} color="#ef4444" />
        </TouchableOpacity>
      </View>

      {/* Edit Profile Modal */}
      {profile && (
        <EditProfileModal
          visible={editModalVisible}
          initialProfile={{
            displayName: profile.display_name,
            bio: profile.bio,
            isPrivate: profile.is_private,
          }}
          onClose={() => setEditModalVisible(false)}
          onUpdated={() => user && fetchProfileData(user.id)}
        />
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  scrollContent: { alignItems: 'center', paddingTop: 32, paddingHorizontal: 24, paddingBottom: 100 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarLetter: { fontSize: 36, fontWeight: '700', color: colors.brand },
  nameGroup: { alignItems: 'center', marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  displayName: { fontSize: 22, fontWeight: '700', color: colors.gray900 },
  username: { fontSize: 14, color: colors.gray500, marginTop: 2 },
  bio: {
    fontSize: 14,
    color: colors.gray600,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 32,
    marginVertical: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.gray200,
    width: '100%',
    justifyContent: 'space-around',
  },
  stat: { alignItems: 'center' },
  statNumber: { fontSize: 18, fontWeight: '700', color: colors.gray900 },
  statLabel: { fontSize: 12, color: colors.gray500, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 12, width: '100%', marginTop: 8 },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 12,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
  },
  editBtnText: { fontSize: 14, fontWeight: '600', color: colors.gray800 },
  signOutBtn: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
  },
})
