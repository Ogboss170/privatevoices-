'use client'

import React, { useState, useRef } from 'react'
import Image from 'next/image'
import { X, Lock, Globe, Camera } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

interface EditProfileModalProps {
  initialProfile: {
    displayName: string
    bio: string | null
    isPrivate: boolean
    avatarUrl?: string | null
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
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initialProfile.avatarUrl || null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.')
      return
    }

    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = () => {
      setAvatarPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

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

    let uploadedAvatarUrl = initialProfile.avatarUrl || null

    if (avatarFile) {
      const fileExt = avatarFile.name.split('.').pop() || 'jpg'
      const fileName = `${user.user.id}/avatar_${Date.now()}.${fileExt}`

      let uploadRes = await supabase.storage
        .from('avatars')
        .upload(fileName, avatarFile, { upsert: true })

      if (uploadRes.error) {
        uploadRes = await supabase.storage
          .from('post-media')
          .upload(`avatars/${fileName}`, avatarFile, { upsert: true })
      }

      if (uploadRes.data) {
        const bucket = uploadRes.data.path.startsWith('avatars/') ? 'post-media' : 'avatars'
        const { data: publicUrlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(uploadRes.data.path)

        uploadedAvatarUrl = publicUrlData.publicUrl
      }
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim(),
        avatar_url: uploadedAvatarUrl,
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
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAvatarChange}
            accept="image/*"
            className="hidden"
          />

          {/* Avatar Photo Picker */}
          <div className="flex flex-col items-center gap-2 py-1">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-20 h-20 rounded-full bg-brand-100 flex items-center justify-center font-bold text-brand-700 text-2xl relative overflow-hidden cursor-pointer group border-2 border-white shadow-md"
            >
              {avatarPreview ? (
                <Image
                  src={avatarPreview}
                  alt={displayName}
                  fill
                  unoptimized
                  className="w-full h-full object-cover"
                />
              ) : (
                displayName.charAt(0).toUpperCase() || 'U'
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Camera size={18} className="text-white drop-shadow-md" />
              </div>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700"
            >
              Change Profile Photo
            </button>
          </div>

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
