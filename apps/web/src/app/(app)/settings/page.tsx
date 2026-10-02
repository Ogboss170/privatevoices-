'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Shield, Lock, Eye, Bell, LogOut, Check } from 'lucide-react'
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
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
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
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
    setSaving(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
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
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link
            href="/profile"
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
            title="Back to Profile"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Settings & Privacy</h1>
        </div>

        {saved && (
          <span className="flex items-center space-x-1 text-xs text-emerald-600 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            <Check size={14} />
            <span>Saved</span>
          </span>
        )}
      </div>

      {/* Account Settings */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center space-x-2 border-b border-gray-100 pb-3">
          <Shield className="text-brand-600" size={18} />
          <h2 className="text-base font-bold text-gray-900">Account Details</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-gray-600 font-medium mb-1">Display Name</label>
            <input
              type="text"
              value={profile?.display_name || ''}
              onChange={(e) => setProfile({ ...profile, display_name: e.target.value })}
              onBlur={() => handleUpdateProfile({ display_name: profile.display_name })}
              className="input-field text-xs"
            />
          </div>
          <div>
            <label className="block text-gray-600 font-medium mb-1">Username</label>
            <input
              type="text"
              disabled
              value={`@${profile?.username || ''}`}
              className="input-field text-xs bg-gray-50 text-gray-400 cursor-not-allowed"
            />
          </div>
        </div>

        <div>
          <label className="block text-gray-600 font-medium mb-1 text-xs">Bio</label>
          <textarea
            rows={2}
            value={profile?.bio || ''}
            onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
            onBlur={() => handleUpdateProfile({ bio: profile.bio })}
            placeholder="Write your bio..."
            className="input-field text-xs resize-none"
          />
        </div>
      </div>

      {/* Privacy & Safety Controls */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center space-x-2 border-b border-gray-100 pb-3">
          <Lock className="text-brand-600" size={18} />
          <h2 className="text-base font-bold text-gray-900">Privacy & Safety</h2>
        </div>

        <div className="space-y-4 divide-y divide-gray-100 text-xs">
          <div className="flex items-center justify-between pt-1">
            <div>
              <span className="font-semibold text-gray-900 block">Private Profile</span>
              <span className="text-gray-500 text-[11px]">Require follow approval for non-followers</span>
            </div>
            <input
              type="checkbox"
              checked={profile?.is_private || false}
              onChange={(e) => handleUpdateProfile({ is_private: e.target.checked })}
              className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500"
            />
          </div>

          <div className="flex items-center justify-between pt-3">
            <div>
              <span className="font-semibold text-gray-900 block">Who can send you Anonymous Whispers?</span>
              <span className="text-gray-500 text-[11px]">Controls who can message via /w/@{profile?.username}</span>
            </div>
            <select
              value={privacy?.whisper_visibility || 'anyone'}
              onChange={(e) => handleUpdatePrivacy('whisper_visibility', e.target.value)}
              className="input-field w-auto py-1 px-2.5 text-xs"
            >
              <option value="anyone">Everyone</option>
              <option value="followers">Followers only</option>
              <option value="nobody">Nobody</option>
            </select>
          </div>

          <div className="flex items-center justify-between pt-3">
            <div>
              <span className="font-semibold text-gray-900 block">Who can message you directly?</span>
              <span className="text-gray-500 text-[11px]">Direct chat messages permission</span>
            </div>
            <select
              value={privacy?.who_can_message || 'anyone'}
              onChange={(e) => handleUpdatePrivacy('who_can_message', e.target.value)}
              className="input-field w-auto py-1 px-2.5 text-xs"
            >
              <option value="anyone">Everyone</option>
              <option value="followers">Followers only</option>
              <option value="nobody">Nobody</option>
            </select>
          </div>
        </div>
      </div>

      {/* Discovery */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center space-x-2 border-b border-gray-100 pb-3">
          <Eye className="text-brand-600" size={18} />
          <h2 className="text-base font-bold text-gray-900">Discovery</h2>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-gray-700 font-medium">Show in recommended accounts</span>
            <input
              type="checkbox"
              checked={privacy?.show_in_recommendations ?? true}
              onChange={(e) => handleUpdatePrivacy('show_in_recommendations', e.target.checked)}
              className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500"
            />
          </div>
        </div>
      </div>

      {/* Sign Out */}
      <div className="card p-4 flex items-center justify-between">
        <span className="text-xs text-gray-500">Sign out of your Private Voices account</span>
        <button
          onClick={handleSignOut}
          className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold rounded-xl transition-colors flex items-center space-x-1.5"
        >
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  )
}
