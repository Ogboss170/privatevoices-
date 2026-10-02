'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
  Check,
  AlertTriangle,
  X,
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export default function SettingsPage(): React.JSX.Element {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [privacy, setPrivacy] = useState<any>(null)

  // Switch / option states
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system')
  const [appLock, setAppLock] = useState(false)
  const [pushNotifs, setPushNotifs] = useState(true)
  const [followerNotifs, setFollowerNotifs] = useState(true)
  const [whisperNotifs, setWhisperNotifs] = useState(true)
  const [messageNotifs, setMessageNotifs] = useState(true)
  const [likeCommentNotifs, setLikeCommentNotifs] = useState(true)
  const [mentionNotifs, setMentionNotifs] = useState(true)
  const [storyNotifs, setStoryNotifs] = useState(true)

  // Delete Account Confirmation Modal states
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0)
  const [deleteInputText, setDeleteInputText] = useState('')
  const [deleting, setDeleting] = useState(false)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    const { data: userRes } = await supabase.auth.getUser()
    if (!userRes.user) {
      router.push('/login')
      return
    }

    setUserId(userRes.user.id)

    const [{ data: prof }, { data: priv }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userRes.user.id).single(),
      supabase.from('privacy_settings').select('*').eq('user_id', userRes.user.id).maybeSingle(),
    ])

    setProfile(prof)
    setPrivacy(priv || {
      whisper_visibility: 'anyone',
      who_can_message: 'anyone',
      show_in_recommendations: true,
      allow_profile_indexing: true,
    })
    setLoading(false)
  }, [supabase, router])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  async function handleUpdateProfile(updates: Partial<any>) {
    if (!userId) return
    setSaving(true)
    const { error } = await supabase.from('profiles').update(updates).eq('id', userId)
    if (!error) {
      setProfile((prev: any) => ({ ...prev, ...updates }))
      showSavedBadge()
    }
    setSaving(false)
  }

  async function handleUpdatePrivacy(key: string, value: any) {
    if (!userId) return
    setSaving(true)

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
      showSavedBadge()
    }
    setSaving(false)
  }

  function showSavedBadge() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleDeleteAccount() {
    if (!userId) return
    setDeleting(true)
    // Delete user profile & data, then sign out
    await supabase.from('profiles').delete().eq('id', userId)
    await supabase.auth.signOut()
    setDeleting(false)
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="card p-12 text-center text-gray-400 max-w-2xl mx-auto">
        <p className="text-sm">Loading settings...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-16">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link
            href="/profile"
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
            title="Back to Profile"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Settings</h1>
        </div>

        {saved && (
          <span className="flex items-center space-x-1 text-xs text-emerald-600 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            <Check size={14} />
            <span>Saved</span>
          </span>
        )}
      </div>

      {/* ── 1. ACCOUNT ── */}
      <section className="card p-6 space-y-4">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-2">
          Account
        </h2>
        <div className="space-y-1 text-sm">
          <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
            <div className="flex items-center space-x-3">
              <User size={18} className="text-gray-500" />
              <div>
                <span className="font-semibold text-gray-800 block">Edit Profile</span>
                <span className="text-xs text-gray-400">Display name, bio, avatar</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </div>

          <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
            <div className="flex items-center space-x-3">
              <AtSign size={18} className="text-gray-500" />
              <div>
                <span className="font-semibold text-gray-800 block">Change Username</span>
                <span className="text-xs text-gray-400">@{profile?.username}</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </div>

          <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
            <div className="flex items-center space-x-3">
              <Mail size={18} className="text-gray-500" />
              <div>
                <span className="font-semibold text-gray-800 block">Change Email</span>
                <span className="text-xs text-gray-400">Update account email address</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </div>

          <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
            <div className="flex items-center space-x-3">
              <KeyRound size={18} className="text-gray-500" />
              <div>
                <span className="font-semibold text-gray-800 block">Change Password</span>
                <span className="text-xs text-gray-400">Update security password</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </div>

          <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
            <div className="flex items-center space-x-3">
              <UserX size={18} className="text-gray-500" />
              <div>
                <span className="font-semibold text-gray-800 block">Deactivate Account</span>
                <span className="text-xs text-gray-400">Temporarily disable your profile</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </div>

          {/* Delete Account (Destructive Action) */}
          <div
            onClick={() => setDeleteStep(1)}
            className="flex items-center justify-between p-2 hover:bg-red-50 rounded-lg cursor-pointer transition-colors text-red-600 mt-2 border-t border-gray-100 pt-3"
          >
            <div className="flex items-center space-x-3">
              <Trash2 size={18} className="text-red-500" />
              <div>
                <span className="font-bold block">Delete Account</span>
                <span className="text-xs text-red-400">Permanently delete account and all data</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-red-400" />
          </div>
        </div>
      </section>

      {/* ── 2. PRIVACY ── */}
      <section className="card p-6 space-y-4">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-2">
          Privacy
        </h2>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between p-2">
            <div className="flex items-center space-x-3">
              <MessageSquare size={18} className="text-gray-500" />
              <div>
                <span className="font-semibold text-gray-800 block">Anonymous Whispers</span>
                <span className="text-xs text-gray-400">Who can send you Whispers</span>
              </div>
            </div>
            <select
              value={privacy?.whisper_visibility || 'anyone'}
              onChange={(e) => handleUpdatePrivacy('whisper_visibility', e.target.value)}
              className="input-field w-auto py-1 px-2 text-xs"
            >
              <option value="anyone">Everyone</option>
              <option value="followers">Followers only</option>
              <option value="nobody">Nobody</option>
            </select>
          </div>

          <div className="flex items-center justify-between p-2">
            <div className="flex items-center space-x-3">
              <Users size={18} className="text-gray-500" />
              <div>
                <span className="font-semibold text-gray-800 block">Who can follow me</span>
                <span className="text-xs text-gray-400">Control who can follow your profile</span>
              </div>
            </div>
            <select className="input-field w-auto py-1 px-2 text-xs" defaultValue="everyone">
              <option value="everyone">Everyone</option>
              <option value="approval">Requires Approval</option>
            </select>
          </div>

          <div className="flex items-center justify-between p-2">
            <div className="flex items-center space-x-3">
              <Shield size={18} className="text-gray-500" />
              <div>
                <span className="font-semibold text-gray-800 block">Who can message me</span>
                <span className="text-xs text-gray-400">Direct chat permissions</span>
              </div>
            </div>
            <select
              value={privacy?.who_can_message || 'anyone'}
              onChange={(e) => handleUpdatePrivacy('who_can_message', e.target.value)}
              className="input-field w-auto py-1 px-2 text-xs"
            >
              <option value="anyone">Everyone</option>
              <option value="followers">Followers only</option>
              <option value="nobody">Nobody</option>
            </select>
          </div>

          <div className="flex items-center justify-between p-2">
            <div className="flex items-center space-x-3">
              <Lock size={18} className="text-gray-500" />
              <div>
                <span className="font-semibold text-gray-800 block">Private Account</span>
                <span className="text-xs text-gray-400">Only approved followers can see posts</span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={profile?.is_private || false}
              onChange={(e) => handleUpdateProfile({ is_private: e.target.checked })}
              className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
            <div className="flex items-center space-x-3">
              <Ban size={18} className="text-gray-500" />
              <div>
                <span className="font-semibold text-gray-800 block">Blocked Accounts</span>
                <span className="text-xs text-gray-400">Manage blocked users</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </div>
        </div>
      </section>

      {/* ── 3. CONTENT & SAFETY ── */}
      <section className="card p-6 space-y-4">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-2">
          Content & Safety
        </h2>
        <div className="space-y-1 text-sm">
          <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
            <div className="flex items-center space-x-3">
              <Eye size={18} className="text-gray-500" />
              <div>
                <span className="font-semibold text-gray-800 block">Sensitive Content</span>
                <span className="text-xs text-gray-400">Filter or blur sensitive material</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </div>

          <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
            <div className="flex items-center space-x-3">
              <Sliders size={18} className="text-gray-500" />
              <div>
                <span className="font-semibold text-gray-800 block">Content Preferences</span>
                <span className="text-xs text-gray-400">Topics & recommendations</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </div>

          <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
            <div className="flex items-center space-x-3">
              <VolumeX size={18} className="text-gray-500" />
              <div>
                <span className="font-semibold text-gray-800 block">Muted Accounts</span>
                <span className="text-xs text-gray-400">Accounts hidden from your feed</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </div>

          <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
            <div className="flex items-center space-x-3">
              <FileText size={18} className="text-gray-500" />
              <div>
                <span className="font-semibold text-gray-800 block">Reports & Appeals</span>
                <span className="text-xs text-gray-400">View status of reported content</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </div>
        </div>
      </section>

      {/* ── 4. SECURITY ── */}
      <section className="card p-6 space-y-4">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-2">
          Security
        </h2>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between p-2">
            <div className="flex items-center space-x-3">
              <Smartphone size={18} className="text-gray-500" />
              <div>
                <span className="font-semibold text-gray-800 block">App Lock / Face ID / Fingerprint</span>
                <span className="text-xs text-gray-400">Require biometric unlock on launch</span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={appLock}
              onChange={(e) => setAppLock(e.target.checked)}
              className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
            <div className="flex items-center space-x-3">
              <History size={18} className="text-gray-500" />
              <div>
                <span className="font-semibold text-gray-800 block">Login Sessions</span>
                <span className="text-xs text-gray-400">Devices currently logged into account</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </div>

          <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors" onClick={handleSignOut}>
            <div className="flex items-center space-x-3 text-red-600">
              <LogOut size={18} />
              <div>
                <span className="font-semibold block">Log out of all devices</span>
                <span className="text-xs text-red-400">Terminate all active sessions</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-red-400" />
          </div>
        </div>
      </section>

      {/* ── 5. NOTIFICATIONS ── */}
      <section className="card p-6 space-y-4">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-2">
          Notifications
        </h2>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between p-2">
            <div className="flex items-center space-x-3">
              <Bell size={18} className="text-gray-500" />
              <span className="font-semibold text-gray-800">Push Notifications</span>
            </div>
            <input
              type="checkbox"
              checked={pushNotifs}
              onChange={(e) => setPushNotifs(e.target.checked)}
              className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between p-2 border-t border-gray-50 pt-2">
            <span className="text-gray-700 pl-7">New Followers</span>
            <input
              type="checkbox"
              checked={followerNotifs}
              onChange={(e) => setFollowerNotifs(e.target.checked)}
              className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between p-2 border-t border-gray-50 pt-2">
            <span className="text-gray-700 pl-7">Whispers</span>
            <input
              type="checkbox"
              checked={whisperNotifs}
              onChange={(e) => setWhisperNotifs(e.target.checked)}
              className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between p-2 border-t border-gray-50 pt-2">
            <span className="text-gray-700 pl-7">Messages</span>
            <input
              type="checkbox"
              checked={messageNotifs}
              onChange={(e) => setMessageNotifs(e.target.checked)}
              className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between p-2 border-t border-gray-50 pt-2">
            <span className="text-gray-700 pl-7">Likes & Comments</span>
            <input
              type="checkbox"
              checked={likeCommentNotifs}
              onChange={(e) => setLikeCommentNotifs(e.target.checked)}
              className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between p-2 border-t border-gray-50 pt-2">
            <span className="text-gray-700 pl-7">Mentions</span>
            <input
              type="checkbox"
              checked={mentionNotifs}
              onChange={(e) => setMentionNotifs(e.target.checked)}
              className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between p-2 border-t border-gray-50 pt-2">
            <span className="text-gray-700 pl-7">Stories</span>
            <input
              type="checkbox"
              checked={storyNotifs}
              onChange={(e) => setStoryNotifs(e.target.checked)}
              className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500 cursor-pointer"
            />
          </div>
        </div>
      </section>

      {/* ── 6. APPEARANCE ── */}
      <section className="card p-6 space-y-4">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-2">
          Appearance
        </h2>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between p-2">
            <div className="flex items-center space-x-3">
              <SunMoon size={18} className="text-gray-500" />
              <div>
                <span className="font-semibold text-gray-800 block">Theme</span>
                <span className="text-xs text-gray-400">Select application visual style</span>
              </div>
            </div>
            <select
              value={theme}
              onChange={(e: any) => setTheme(e.target.value)}
              className="input-field w-auto py-1 px-2 text-xs"
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          <div className="flex items-center justify-between p-2">
            <div className="flex items-center space-x-3">
              <Globe size={18} className="text-gray-500" />
              <span className="font-semibold text-gray-800">Language</span>
            </div>
            <span className="text-xs text-gray-500 font-medium">English (US)</span>
          </div>
        </div>
      </section>

      {/* ── 7. DATA & PRIVACY ── */}
      <section className="card p-6 space-y-4">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-2">
          Data & Privacy
        </h2>
        <div className="space-y-1 text-sm">
          <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
            <div className="flex items-center space-x-3">
              <Download size={18} className="text-gray-500" />
              <div>
                <span className="font-semibold text-gray-800 block">Download My Data</span>
                <span className="text-xs text-gray-400">Request archive of your posts and whispers</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </div>

          <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
            <div className="flex items-center space-x-3">
              <Shield size={18} className="text-gray-500" />
              <div>
                <span className="font-semibold text-gray-800 block">Data & Privacy Information</span>
                <span className="text-xs text-gray-400">How your data is protected and encrypted</span>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </div>
        </div>
      </section>

      {/* ── 8. ABOUT ── */}
      <section className="card p-6 space-y-4">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-2">
          About
        </h2>
        <div className="space-y-1 text-sm">
          <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
            <div className="flex items-center space-x-3">
              <BookOpen size={18} className="text-gray-500" />
              <span className="font-semibold text-gray-800">Community Guidelines</span>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </div>

          <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
            <div className="flex items-center space-x-3">
              <FileText size={18} className="text-gray-500" />
              <span className="font-semibold text-gray-800">Terms & Conditions</span>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </div>

          <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
            <div className="flex items-center space-x-3">
              <Shield size={18} className="text-gray-500" />
              <span className="font-semibold text-gray-800">Privacy Policy</span>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </div>

          <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
            <div className="flex items-center space-x-3">
              <HelpCircle size={18} className="text-gray-500" />
              <span className="font-semibold text-gray-800">Help & Support</span>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </div>

          <div className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
            <div className="flex items-center space-x-3">
              <Info size={18} className="text-gray-500" />
              <span className="font-semibold text-gray-800">About Private Voices</span>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </div>

          <div className="flex items-center justify-between p-2 pt-3 border-t border-gray-100 text-xs text-gray-400">
            <span>App Version</span>
            <span className="font-mono">v1.0.4 (Production)</span>
          </div>
        </div>
      </section>

      {/* ── DELETE ACCOUNT MODAL DIALOGS ── */}
      {deleteStep > 0 && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-red-100">
            {deleteStep === 1 && (
              <>
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div className="flex items-center space-x-2 text-red-600 font-bold text-lg">
                    <AlertTriangle size={22} />
                    <span>Delete Account Confirmation</span>
                  </div>
                  <button onClick={() => setDeleteStep(0)} className="text-gray-400 hover:text-gray-600">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-3 text-sm text-gray-600">
                  <p className="font-semibold text-gray-900">Are you sure you want to delete your account?</p>
                  <p>Deleting your account will result in:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs text-red-700 bg-red-50 p-3 rounded-lg border border-red-100">
                    <li>Permanent removal of your profile (@{profile?.username})</li>
                    <li>Deletion of all published Voices, posts, and stories</li>
                    <li>Deletion of all direct chat messages and history</li>
                    <li>Deletion of received Anonymous Whispers</li>
                  </ul>
                </div>

                <div className="flex items-center justify-end space-x-3 pt-2">
                  <button
                    onClick={() => setDeleteStep(0)}
                    className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setDeleteStep(2)}
                    className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors"
                  >
                    Proceed to Final Confirmation
                  </button>
                </div>
              </>
            )}

            {deleteStep === 2 && (
              <>
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div className="flex items-center space-x-2 text-red-600 font-bold text-lg">
                    <Trash2 size={22} />
                    <span>Final Confirmation</span>
                  </div>
                  <button onClick={() => setDeleteStep(0)} className="text-gray-400 hover:text-gray-600">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-3 text-sm text-gray-600">
                  <p className="font-bold text-red-600">This action CANNOT be undone.</p>
                  <p className="text-xs text-gray-500">
                    To confirm permanent deletion, please type <span className="font-mono font-bold text-gray-900">DELETE</span> below:
                  </p>
                  <input
                    type="text"
                    value={deleteInputText}
                    onChange={(e) => setDeleteInputText(e.target.value)}
                    placeholder="Type DELETE"
                    className="input-field text-sm font-mono tracking-widest text-center"
                  />
                </div>

                <div className="flex items-center justify-end space-x-3 pt-2">
                  <button
                    onClick={() => setDeleteStep(0)}
                    className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={deleteInputText !== 'DELETE' || deleting}
                    onClick={handleDeleteAccount}
                    className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors"
                  >
                    {deleting ? 'Deleting...' : 'Permanently Delete My Account'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

