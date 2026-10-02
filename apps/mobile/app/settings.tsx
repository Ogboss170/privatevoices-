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
  Modal,
  TextInput,
} from 'react-native'
import {
  ArrowLeft,
  User,
  AtSign,
  Mail,
  KeyRound,
  UserX,
  Trash2,
  Lock,
  MessageSquare,
  Users,
  Shield,
  Ban,
  Eye,
  Sliders,
  VolumeX,
  FileText,
  Smartphone,
  History,
  LogOut,
  Bell,
  SunMoon,
  Globe,
  Download,
  BookOpen,
  HelpCircle,
  Info,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { colors } from '../constants/colors'

export default function SettingsScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [privacy, setPrivacy] = useState<any>(null)
  const [userId, setUserId] = useState<string | null>(null)

  // Preference states
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system')
  const [appLock, setAppLock] = useState(false)
  const [pushNotifs, setPushNotifs] = useState(true)
  const [followerNotifs, setFollowerNotifs] = useState(true)
  const [whisperNotifs, setWhisperNotifs] = useState(true)
  const [messageNotifs, setMessageNotifs] = useState(true)
  const [likeCommentNotifs, setLikeCommentNotifs] = useState(true)
  const [mentionNotifs, setMentionNotifs] = useState(true)
  const [storyNotifs, setStoryNotifs] = useState(true)

  // Delete account confirmation modal step (0=hidden, 1=explanation, 2=type DELETE)
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

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

  async function handlePermanentDelete() {
    if (!userId) return
    setDeleting(true)
    await supabase.from('profiles').delete().eq('id', userId)
    await supabase.auth.signOut()
    setDeleting(false)
    setDeleteStep(0)
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
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      {/* ── 1. ACCOUNT ── */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionCategoryTitle}>ACCOUNT</Text>

        <TouchableOpacity style={styles.rowItem} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <User size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>Edit Profile</Text>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.rowItem} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <AtSign size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>Change Username</Text>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.rowItem} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <Mail size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>Change Email</Text>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.rowItem} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <KeyRound size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>Change Password</Text>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.rowItem} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <UserX size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>Deactivate Account</Text>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.rowItem, styles.destructiveRow]}
          onPress={() => setDeleteStep(1)}
          activeOpacity={0.7}
        >
          <View style={styles.rowLeft}>
            <Trash2 size={18} color="#ef4444" />
            <Text style={styles.destructiveLabel}>Delete Account</Text>
          </View>
          <ChevronRight size={18} color="#ef4444" />
        </TouchableOpacity>
      </View>

      {/* ── 2. PRIVACY ── */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionCategoryTitle}>PRIVACY</Text>

        <View style={styles.rowItemNoClick}>
          <View style={styles.rowLeft}>
            <MessageSquare size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>Anonymous Whispers</Text>
          </View>
        </View>
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

        <TouchableOpacity style={styles.rowItem} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <Users size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>Who can follow me</Text>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.rowItem} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <Shield size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>Who can message me</Text>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>

        <View style={styles.rowItemNoClick}>
          <View style={styles.rowLeft}>
            <Lock size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>Private Account</Text>
          </View>
          <Switch
            value={profile?.is_private || false}
            onValueChange={(val) => handleUpdateProfile({ is_private: val })}
            trackColor={{ false: '#e2e8f0', true: colors.brand }}
          />
        </View>

        <TouchableOpacity style={styles.rowItem} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <Ban size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>Blocked Accounts</Text>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>
      </View>

      {/* ── 3. CONTENT & SAFETY ── */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionCategoryTitle}>CONTENT & SAFETY</Text>

        <TouchableOpacity style={styles.rowItem} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <Eye size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>Sensitive Content</Text>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.rowItem} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <Sliders size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>Content Preferences</Text>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.rowItem} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <VolumeX size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>Muted Accounts</Text>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.rowItem} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <FileText size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>Reports & Appeals</Text>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>
      </View>

      {/* ── 4. SECURITY ── */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionCategoryTitle}>SECURITY</Text>

        <View style={styles.rowItemNoClick}>
          <View style={styles.rowLeft}>
            <Smartphone size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>App Lock / Face ID / Fingerprint</Text>
          </View>
          <Switch
            value={appLock}
            onValueChange={setAppLock}
            trackColor={{ false: '#e2e8f0', true: colors.brand }}
          />
        </View>

        <TouchableOpacity style={styles.rowItem} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <History size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>Login Sessions</Text>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.rowItem} onPress={handleSignOut} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <LogOut size={18} color="#ef4444" />
            <Text style={styles.destructiveLabel}>Log out of all devices</Text>
          </View>
          <ChevronRight size={18} color="#ef4444" />
        </TouchableOpacity>
      </View>

      {/* ── 5. NOTIFICATIONS ── */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionCategoryTitle}>NOTIFICATIONS</Text>

        <View style={styles.rowItemNoClick}>
          <View style={styles.rowLeft}>
            <Bell size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>Push Notifications</Text>
          </View>
          <Switch
            value={pushNotifs}
            onValueChange={setPushNotifs}
            trackColor={{ false: '#e2e8f0', true: colors.brand }}
          />
        </View>

        <View style={styles.rowItemNoClickSub}>
          <Text style={styles.rowSubLabel}>New Followers</Text>
          <Switch
            value={followerNotifs}
            onValueChange={setFollowerNotifs}
            trackColor={{ false: '#e2e8f0', true: colors.brand }}
          />
        </View>

        <View style={styles.rowItemNoClickSub}>
          <Text style={styles.rowSubLabel}>Whispers</Text>
          <Switch
            value={whisperNotifs}
            onValueChange={setWhisperNotifs}
            trackColor={{ false: '#e2e8f0', true: colors.brand }}
          />
        </View>

        <View style={styles.rowItemNoClickSub}>
          <Text style={styles.rowSubLabel}>Messages</Text>
          <Switch
            value={messageNotifs}
            onValueChange={setMessageNotifs}
            trackColor={{ false: '#e2e8f0', true: colors.brand }}
          />
        </View>

        <View style={styles.rowItemNoClickSub}>
          <Text style={styles.rowSubLabel}>Likes & Comments</Text>
          <Switch
            value={likeCommentNotifs}
            onValueChange={setLikeCommentNotifs}
            trackColor={{ false: '#e2e8f0', true: colors.brand }}
          />
        </View>

        <View style={styles.rowItemNoClickSub}>
          <Text style={styles.rowSubLabel}>Mentions</Text>
          <Switch
            value={mentionNotifs}
            onValueChange={setMentionNotifs}
            trackColor={{ false: '#e2e8f0', true: colors.brand }}
          />
        </View>

        <View style={styles.rowItemNoClickSub}>
          <Text style={styles.rowSubLabel}>Stories</Text>
          <Switch
            value={storyNotifs}
            onValueChange={setStoryNotifs}
            trackColor={{ false: '#e2e8f0', true: colors.brand }}
          />
        </View>
      </View>

      {/* ── 6. APPEARANCE ── */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionCategoryTitle}>APPEARANCE</Text>

        <View style={styles.rowItemNoClick}>
          <View style={styles.rowLeft}>
            <SunMoon size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>Theme</Text>
          </View>
        </View>
        <View style={styles.optionsGroup}>
          {(['system', 'light', 'dark'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.optionBtn, theme === t && styles.optionBtnActive]}
              onPress={() => setTheme(t)}
            >
              <Text style={[styles.optionText, theme === t && styles.optionTextActive]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.rowItemNoClick}>
          <View style={styles.rowLeft}>
            <Globe size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>Language</Text>
          </View>
          <Text style={styles.valueText}>English (US)</Text>
        </View>
      </View>

      {/* ── 7. DATA & PRIVACY ── */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionCategoryTitle}>DATA & PRIVACY</Text>

        <TouchableOpacity style={styles.rowItem} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <Download size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>Download My Data</Text>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.rowItem} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <Shield size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>Data & Privacy</Text>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>
      </View>

      {/* ── 8. ABOUT ── */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionCategoryTitle}>ABOUT</Text>

        <TouchableOpacity style={styles.rowItem} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <BookOpen size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>Community Guidelines</Text>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.rowItem} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <FileText size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>Terms & Conditions</Text>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.rowItem} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <Shield size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>Privacy Policy</Text>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.rowItem} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <HelpCircle size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>Help & Support</Text>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.rowItem} activeOpacity={0.7}>
          <View style={styles.rowLeft}>
            <Info size={18} color={colors.gray600} />
            <Text style={styles.rowLabel}>About Private Voices</Text>
          </View>
          <ChevronRight size={18} color={colors.gray400} />
        </TouchableOpacity>

        <View style={styles.versionRow}>
          <Text style={styles.versionLabel}>App Version</Text>
          <Text style={styles.versionVal}>v1.0.4 (Production)</Text>
        </View>
      </View>

      {/* Sign Out Button */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <LogOut size={18} color="#ef4444" />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      {/* Delete Account Step 1 Modal */}
      <Modal visible={deleteStep === 1} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <AlertTriangle size={22} color="#ef4444" />
              <Text style={styles.modalTitleRed}>Delete Account</Text>
            </View>
            <Text style={styles.modalBodyText}>
              Are you sure you want to delete your account? This will permanently erase your profile, posts, messages, stories, and received Whispers.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setDeleteStep(0)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalDangerBtn}
                onPress={() => setDeleteStep(2)}
              >
                <Text style={styles.modalDangerText}>Proceed</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Account Step 2 Modal */}
      <Modal visible={deleteStep === 2} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Trash2 size={22} color="#ef4444" />
              <Text style={styles.modalTitleRed}>Final Confirmation</Text>
            </View>
            <Text style={styles.modalBodyText}>
              This action CANNOT be undone. Type <Text style={styles.boldMono}>DELETE</Text> to confirm:
            </Text>
            <TextInput
              style={styles.deleteInput}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder="Type DELETE"
              placeholderTextColor={colors.gray400}
              autoCapitalize="characters"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setDeleteStep(0)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalDangerBtn,
                  (deleteConfirmText !== 'DELETE' || deleting) && styles.disabledBtn,
                ]}
                disabled={deleteConfirmText !== 'DELETE' || deleting}
                onPress={handlePermanentDelete}
              >
                <Text style={styles.modalDangerText}>
                  {deleting ? 'Deleting...' : 'Delete Permanently'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  content: { padding: 20, paddingBottom: 100, gap: 16 },
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
  sectionCategoryTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gray400,
    letterSpacing: 0.8,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
    paddingBottom: 6,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  destructiveRow: {
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
    paddingTop: 10,
    marginTop: 4,
  },
  rowItemNoClick: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  rowItemNoClickSub: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingLeft: 26,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray800,
  },
  rowSubLabel: {
    fontSize: 13,
    color: colors.gray600,
  },
  destructiveLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ef4444',
  },
  valueText: {
    fontSize: 13,
    color: colors.gray500,
    fontWeight: '500',
  },
  optionsGroup: { flexDirection: 'row', gap: 8, marginVertical: 4 },
  optionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 8,
    alignItems: 'center',
  },
  optionBtnActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  optionText: { fontSize: 12, fontWeight: '600', color: colors.gray700 },
  optionTextActive: { color: '#ffffff' },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
    paddingTop: 10,
    marginTop: 4,
  },
  versionLabel: { fontSize: 12, color: colors.gray400 },
  versionVal: { fontSize: 12, color: colors.gray500, fontFamily: 'monospace' },
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitleRed: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ef4444',
  },
  modalBodyText: {
    fontSize: 13,
    color: colors.gray600,
    lineHeight: 18,
  },
  boldMono: {
    fontWeight: 'bold',
    fontFamily: 'monospace',
    color: colors.gray900,
  },
  deleteInput: {
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    textAlign: 'center',
    letterSpacing: 2,
    fontWeight: 'bold',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  modalCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray600,
  },
  modalDangerBtn: {
    backgroundColor: '#ef4444',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  disabledBtn: {
    opacity: 0.4,
  },
  modalDangerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
})

