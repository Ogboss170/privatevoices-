import { notFound } from 'next/navigation'
import Image from 'next/image'
import type { Metadata } from 'next'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import PostCard from '@/components/feed/PostCard'
import PublicProfileHeader from '@/components/profile/PublicProfileHeader'
import type { PublicProfile, Post } from '@private-voices/shared'

interface Props {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params
  const cleanUsername = decodeURIComponent(username).replace(/^@/, '')
  return {
    title: `@${cleanUsername}`,
    description: `View @${cleanUsername}'s profile on Private Voices`,
  }
}

async function getProfileData(rawUsername: string, currentUserId?: string) {
  const supabase = await createSupabaseServerClient()
  const cleanUsername = decodeURIComponent(rawUsername).replace(/^@/, '')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, bio, avatar_url, is_private')
    .ilike('username', cleanUsername)
    .maybeSingle()

  if (error || !profile) return null

  const [{ count: followerCount }, { count: followingCount }, { count: postCount }] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', profile.id),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profile.id),
    supabase.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', profile.id),
  ])

  let isFollowing = false
  if (currentUserId && currentUserId !== profile.id) {
    const { data: follow } = await supabase
      .from('follows')
      .select('follower_id')
      .match({ follower_id: currentUserId, following_id: profile.id })
      .maybeSingle()
    isFollowing = !!follow
  }

  let posts: Post[] = []
  const canViewPosts = !profile.is_private || isFollowing || currentUserId === profile.id

  if (canViewPosts) {
    const { data: postRows } = await supabase
      .from('posts')
      .select('*, author:profiles!posts_author_id_fkey(id, username, display_name, avatar_url)')
      .eq('author_id', profile.id)
      .order('created_at', { ascending: false })

    if (postRows) {
      posts = await Promise.all(
        postRows.map(async (p) => {
          const [{ count: likeCount }, { count: commentCount }] = await Promise.all([
            supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
            supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', p.id),
          ])

          let isLikedByMe = false
          let isSavedByMe = false
          if (currentUserId) {
            const [{ data: like }, { data: save }] = await Promise.all([
              supabase.from('likes').select('user_id').match({ user_id: currentUserId, post_id: p.id }).maybeSingle(),
              supabase.from('saved_posts').select('user_id').match({ user_id: currentUserId, post_id: p.id }).maybeSingle(),
            ])
            isLikedByMe = !!like
            isSavedByMe = !!save
          }

          const authorObj = p.author || profile
          return {
            id: p.id,
            authorId: p.author_id,
            author: {
              id: authorObj.id,
              username: authorObj.username,
              displayName: authorObj.display_name,
              avatarUrl: authorObj.avatar_url,
            },
            content: p.content,
            imageUrls: p.image_urls ?? [],
            hashtags: [],
            likeCount: likeCount ?? 0,
            commentCount: commentCount ?? 0,
            repostCount: 0,
            isLikedByMe,
            isSavedByMe,
            isRepostedByMe: false,
            createdAt: p.created_at,
            updatedAt: p.updated_at,
          }
        })
      )
    }
  }

  return {
    profile: {
      id: profile.id,
      username: profile.username,
      displayName: profile.display_name,
      bio: profile.bio,
      avatarUrl: profile.avatar_url,
      isPrivate: profile.is_private,
      followerCount: followerCount ?? 0,
      followingCount: followingCount ?? 0,
      postCount: postCount ?? 0,
    } as PublicProfile,
    isFollowing,
    canViewPosts,
    posts,
  }
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const data = await getProfileData(username, user?.id)

  if (!data) notFound()

  const { profile, isFollowing, canViewPosts, posts } = data
  const isSelf = user?.id === profile.id

  return (
    <main className="min-h-screen bg-gray-50 pb-12">
      {/* Header Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-bold text-gray-900">@{profile.username}</span>
          <span className="text-xs text-gray-500">{profile.postCount} Posts</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Profile Card with interactive following and followers modal */}
        <PublicProfileHeader
          profile={profile}
          currentUserId={user?.id}
          initialIsFollowing={isFollowing}
        />

        {/* Private profile notice */}
        {!canViewPosts ? (
          <div className="card p-8 text-center space-y-2">
            <div className="text-4xl">🔒</div>
            <h2 className="font-semibold text-gray-900">This account is private</h2>
            <p className="text-sm text-gray-500">
              Follow @{profile.username} to see their posts.
            </p>
          </div>
        ) : posts.length === 0 ? (
          <div className="card p-8 text-center text-gray-400">
            <p className="text-sm">No posts published yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post: Post) => (
              <PostCard key={post.id} post={post} currentUserId={user?.id} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
