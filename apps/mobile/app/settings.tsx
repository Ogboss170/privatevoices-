import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { ArrowLeft, Shield, Lock, Eye, LogOut } from 'lucide-react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { colors } from '../constants/colors'

export default function SettingsScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [privacy, setPrivacy] = useState<any>(null)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id)
        fetchSettings(data.user.id)
      }
    })
  }, [])

  async function fetchSettings(uId: string) {
    const [{ data: prof }, { data: priv }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uId).single(),
      supabase.from('privacy_settings').select('*').eq('user_id', uId).maybeSingle(),
    ])

    setProfile(prof)
    setPrivacy(priv || { whisper_visibility: 'anyone', who_can_message: 'anyone', show_in_recommendations: true })
    setLoading(false)
  }

  async function handleUpdateProfile(updates: Partial<any>) {
    if (!userId) return
    const { error } = await supabase.from('profiles').update(updates).eq('id', userId)
    if (!error) {
      setProfile((prev: any) => ({ ...prev, ...updates }))
    }
  }

  async function handleUpdatePrivacy(key: string, value: any) {
    if (!userId) return

    const { data: existing } = await supabase
      .from('privacy_settings')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    let error
    if (existing) {
      const res = await supabase.from('privacy_settings').update({ [key]: value }).eq('user_id', userId)
      error = res.error
    } else {
      const res = await supabase.from('privacy_settings').insert({ user_id: userId, [key]: value })
      error = res.error
    }

    if (!error) {
      setPrivacy((prev: any) => ({ ...prev, [key]: value }))
    }
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
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={colors.gray800} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings & Privacy</Text>
      </View>

      {/* Account Section */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Shield size={18} color={colors.brand} />
          <Text style={styles.sectionTitle}>Account Details</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Display Name</Text>
          <Text style={styles.value}>{profile?.display_name}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Username</Text>
          <Text style={styles.value}>@{profile?.username}</Text>
        </View>
      </View>

      {/* Privacy Section */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Lock size={18} color={colors.brand} />
          <Text style={styles.sectionTitle}>Privacy & Safety</Text>
        </View>

        <View style={styles.row}>
          <View style={styles.labelCol}>
            <Text style={styles.label}>Private Profile</Text>
            <Text style={styles.sublabel}>Require follow approval</Text>
          </View>
          <Switch
            value={profile?.is_private || false}
            onValueChange={(val) => handleUpdateProfile({ is_private: val })}
            trackColor={{ false: '#e2e8f0', true: colors.brand }}
          />
        </View>

        <View style={styles.divider} />

        <Text style={styles.settingHeading}>Who can send you Whispers?</Text>
        <View style={styles.optionsGroup}>
          {(['anyone', 'followers', 'nobody'] as const).map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[
                styles.optionBtn,
                privacy?.whisper_visibility === opt && styles.optionBtnActive,
              ]}
              onPress={() => handleUpdatePrivacy('whisper_visibility', opt)}
            >
              <Text
                style={[
                  styles.optionText,
                  privacy?.whisper_visibility === opt && styles.optionTextActive,
                ]}
              >
                {opt === 'anyone' ? 'Everyone' : opt === 'followers' ? 'Followers' : 'Nobody'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Discovery Section */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Eye size={18} color={colors.brand} />
          <Text style={styles.sectionTitle}>Discovery</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Show in recommendations</Text>
          <Switch
            value={privacy?.show_in_recommendations ?? true}
            onValueChange={(val) => handleUpdatePrivacy('show_in_recommendations', val)}
            trackColor={{ false: '#e2e8f0', true: colors.brand }}
          />
        </View>
      </View>

      {/* Sign Out Button */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <LogOut size={18} color="#ef4444" />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  content: { padding: 20, paddingBottom: 60, gap: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8, marginTop: 12 },
  backBtn: { padding: 8, borderRadius: 20, backgroundColor: '#ffffff' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.gray900 },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.gray200,
    gap: 12,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.gray100 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.gray900 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  labelCol: { flex: 1, marginRight: 8 },
  label: { fontSize: 14, fontWeight: '600', color: colors.gray800 },
  sublabel: { fontSize: 11, color: colors.gray500, marginTop: 2 },
  value: { fontSize: 14, color: colors.gray600, fontWeight: '500' },
  divider: { height: 1, backgroundColor: colors.gray100, marginVertical: 4 },
  settingHeading: { fontSize: 13, fontWeight: '600', color: colors.gray700, marginTop: 4 },
  optionsGroup: { flexDirection: 'row', gap: 8 },
  optionBtn: { flex: 1, paddingVertical: 8, borderWidth: 1, borderColor: colors.gray300, borderRadius: 8, alignItems: 'center' },
  optionBtnActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  optionText: { fontSize: 12, fontWeight: '600', color: colors.gray700 },
  optionTextActive: { color: '#ffffff' },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 12,
  },
  signOutText: { fontSize: 14, fontWeight: '700', color: '#ef4444' },
})
