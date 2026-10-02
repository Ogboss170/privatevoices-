import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { colors } from '../../constants/colors'
import type { User } from '@supabase/supabase-js'

export default function ProfileScreen() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<{
    display_name: string
    username: string
    bio: string | null
    avatar_url: string | null
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      if (data.user) fetchProfile(data.user.id)
    })
  }, [])

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('display_name, username, bio, avatar_url')
      .eq('id', userId)
      .single()
    setProfile(data)
    setLoading(false)
  }

  async function handleSignOut() {
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
        <ActivityIndicator color={colors.brand} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Avatar placeholder */}
      <View style={styles.avatarCircle}>
        <Text style={styles.avatarLetter}>
          {profile?.display_name?.charAt(0)?.toUpperCase() ?? '?'}
        </Text>
      </View>

      <Text style={styles.displayName}>{profile?.display_name}</Text>
      <Text style={styles.username}>@{profile?.username}</Text>

      {profile?.bio && (
        <Text style={styles.bio}>{profile.bio}</Text>
      )}

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>0</Text>
          <Text style={styles.statLabel}>posts</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>0</Text>
          <Text style={styles.statLabel}>followers</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNumber}>0</Text>
          <Text style={styles.statLabel}>following</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', paddingTop: 40, backgroundColor: colors.gray50, paddingHorizontal: 24 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  avatarLetter: { fontSize: 36, fontWeight: '700', color: colors.brand },
  displayName: { fontSize: 22, fontWeight: '700', color: colors.gray900 },
  username: { fontSize: 14, color: colors.gray500, marginTop: 2, marginBottom: 8 },
  bio: { fontSize: 14, color: colors.gray600, textAlign: 'center', maxWidth: 280, lineHeight: 20, marginBottom: 8 },
  statsRow: { flexDirection: 'row', gap: 32, marginTop: 16, marginBottom: 32 },
  stat: { alignItems: 'center' },
  statNumber: { fontSize: 18, fontWeight: '700', color: colors.gray900 },
  statLabel: { fontSize: 12, color: colors.gray500, marginTop: 2 },
  signOutButton: {
    borderWidth: 1, borderColor: colors.gray300, borderRadius: 10,
    paddingHorizontal: 24, paddingVertical: 10,
  },
  signOutText: { fontSize: 14, fontWeight: '600', color: colors.gray700 },
})
