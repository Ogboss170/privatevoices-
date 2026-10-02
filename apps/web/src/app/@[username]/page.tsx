import { notFound } from 'next/navigation'
import Image from 'next/image'
import type { Metadata } from 'next'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { PublicProfile } from '@private-voices/shared'

interface Props {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params
  return {
    title: `@${username}`,
    description: `View @${username}'s profile on Private Voices`,
  }
}

async function getProfile(username: string): Promise<PublicProfile | null> {
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id,
      username,
      display_name,
      bio,
      avatar_url,
      is_private
    `)
    .ilike('username', username)
    .single()

  if (error || !data) return null

  // Get follower and following counts
  const [{ count: followerCount }, { count: followingCount }] = await Promise.all([
    supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', data.id),
    supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', data.id),
  ])

  return {
    id: data.id,
    username: data.username,
    displayName: data.display_name,
    bio: data.bio,
    avatarUrl: data.avatar_url,
    isPrivate: data.is_private,
    followerCount: followerCount ?? 0,
    followingCount: followingCount ?? 0,
    postCount: 0, // Phase 2
  }
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params
  const profile = await getProfile(username)

  if (!profile) notFound()

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center">
          <span className="font-semibold text-gray-900">@{profile.username}</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Profile card */}
        <div className="card p-6">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="flex-shrink-0">
              {profile.avatarUrl ? (
                <Image
                  src={profile.avatarUrl}
                  alt={profile.displayName}
                  width={80}
                  height={80}
                  className="rounded-full object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-brand-100 flex items-center justify-center">
                  <span className="text-2xl font-bold text-brand-600">
                    {profile.displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900">{profile.displayName}</h1>
              <p className="text-sm text-gray-500">@{profile.username}</p>

              {profile.bio && (
                <p className="mt-2 text-sm text-gray-700">{profile.bio}</p>
              )}

              {/* Stats */}
              <div className="mt-3 flex gap-4 text-sm">
                <div>
                  <span className="font-semibold text-gray-900">{profile.followerCount}</span>{' '}
                  <span className="text-gray-500">followers</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-900">{profile.followingCount}</span>{' '}
                  <span className="text-gray-500">following</span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-4 flex gap-3">
            <button className="btn-primary flex-1">Follow</button>
            <button className="btn-secondary flex-1">
              💬 Send Whisper
            </button>
          </div>
        </div>

        {/* Private profile notice */}
        {profile.isPrivate && (
          <div className="card p-6 text-center">
            <div className="text-4xl mb-2">🔒</div>
            <h2 className="font-semibold text-gray-900">This account is private</h2>
            <p className="text-sm text-gray-500 mt-1">
              Follow @{profile.username} to see their posts.
            </p>
          </div>
        )}

        {/* Posts placeholder (Phase 2) */}
        {!profile.isPrivate && (
          <div className="card p-6 text-center text-gray-400">
            <p className="text-sm">No posts yet.</p>
          </div>
        )}
      </div>
    </main>
  )
}
