'use client'

import React, { useState } from 'react'
import { X, Lock, Globe } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

interface EditProfileModalProps {
  initialProfile: {
    displayName: string
    bio: string | null
    isPrivate: boolean
  }
  onClose: () => void
  onUpdated: () => void
}

export default function EditProfileModal({
  initialProfile,
  onClose,
  onUpdated,
}: EditProfileModalProps): React.JSX.Element {
  const supabase = createSupabaseBrowserClient()
  const [displayName, setDisplayName] = useState(initialProfile.displayName)
  const [bio, setBio] = useState(initialProfile.bio ?? '')
  const [isPrivate, setIsPrivate] = useState(initialProfile.isPrivate)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data: user } = await supabase.auth.getUser()
    if (!user.user) {
      setError('Not authenticated')
      setLoading(false)
      return
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim(),
        bio: bio.trim() || null,
        is_private: isPrivate,
      })
      .eq('id', user.user.id)

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setLoading(false)
    onUpdated()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="card w-full max-w-md p-6 bg-white space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <h2 className="text-lg font-bold text-gray-900">Edit Profile</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Display Name</label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="input-field text-sm"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Bio</label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="input-field text-sm resize-none"
              placeholder="Tell the world a little about yourself..."
              maxLength={160}
            />
            <span className="text-[10px] text-gray-400 text-right block mt-1">
              {bio.length}/160
            </span>
          </div>

          {/* Privacy Switch */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200">
            <div className="flex items-center gap-2.5">
              {isPrivate ? <Lock size={18} className="text-brand-600" /> : <Globe size={18} className="text-gray-500" />}
              <div>
                <h4 className="text-xs font-bold text-gray-900">Private Account</h4>
                <p className="text-[11px] text-gray-500">Only approved followers can see your posts</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsPrivate(!isPrivate)}
              className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                isPrivate ? 'bg-brand-600' : 'bg-gray-300'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  isPrivate ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm py-2">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1 text-sm py-2">
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
