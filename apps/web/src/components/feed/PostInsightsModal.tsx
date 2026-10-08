'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { X, TrendingUp, Heart, MessageCircle, Repeat, Bookmark, Share2, Award, Zap, Clock, Eye, Users, Shield, Lock } from 'lucide-react'
import type { Post } from '@private-voices/shared'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

interface PostInsightsModalProps {
  post: Post
  currentUserId?: string
  onClose: () => void
}

export default function PostInsightsModal({ post, currentUserId, onClose }: PostInsightsModalProps): React.JSX.Element | null {
  const supabase = createSupabaseBrowserClient()
  const isAuthor = currentUserId === post.authorId

  // Strict privacy rule: Only the post author can view Analytics & Insights
  if (!isAuthor) {
    onClose()
    return null
  }

  const [viewCount, setViewCount] = useState<number>(post.viewCount || 0)
  const [viewers, setViewers] = useState<any[]>([])
  const [loadingViewers, setLoadingViewers] = useState<boolean>(true)

  const postAny = post as any
  const likeCount = post.likeCount || 0
  const commentCount = post.commentCount || 0
  const repostCount = post.repostCount || 0
  const bookmarkCount = postAny.bookmarkCount || postAny.saveCount || 0
  const shareCount = postAny.shareCount || 0
  const totalEngagement = likeCount + commentCount + repostCount + bookmarkCount

  // Calculate Engagement Rate: Total Interactions / Unique Views
  const engagementRate = viewCount > 0 ? Math.min(100, Math.round((totalEngagement / viewCount) * 100)) : 0

  useEffect(() => {
    async function fetchInsights() {
      // 1. Fetch total 24h unique view count
      try {
        const { data: vCount } = await supabase.rpc('get_post_view_count', { p_post_id: post.id })
        if (typeof vCount === 'number') {
          setViewCount(vCount)
        }
      } catch {
        // ignore
      }

      // 2. Author-Only Viewer Profile List (strictly prohibited for non-authors)
      if (isAuthor) {
        setLoadingViewers(true)
        try {
          const { data, error } = await supabase
            .from('post_views')
            .select('viewed_at, viewer:profiles!post_views_viewer_id_fkey(id, username, display_name, avatar_url)')
            .eq('post_id', post.id)
            .order('viewed_at', { ascending: false })
            .limit(50)

          if (!error && data) {
            setViewers(data)
          }
        } catch {
          // ignore
        } finally {
          setLoadingViewers(false)
        }
      }
    }

    fetchInsights()
  }, [post.id, isAuthor, supabase])

  let statusText = 'Fresh Voice'
  let statusBadgeColor = 'bg-blue-500/10 text-blue-500 border-blue-500/30'
  let progressPercent = 20

  if (totalEngagement > 25 || viewCount > 100) {
    statusText = '🔥 Trending & Viral'
    statusBadgeColor = 'bg-red-500/10 text-red-500 border-red-500/30'
    progressPercent = 95
  } else if (totalEngagement > 10 || viewCount > 40) {
    statusText = '🚀 High Engagement'
    statusBadgeColor = 'bg-purple-500/10 text-purple-500 border-purple-500/30'
    progressPercent = 75
  } else if (totalEngagement > 3 || viewCount > 10) {
    statusText = '📈 Rising Voice'
    statusBadgeColor = 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
    progressPercent = 50
  }

  const createdDate = new Date(post.createdAt)
  const hoursAgo = Math.max(1, Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60)))

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 relative max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={20} className="text-brand-600" />
            <h3 className="text-lg font-bold text-gray-900">Post Analytics & Insights</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto pr-1 flex-1">
          {/* Status Card */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className={`px-2.5 py-1 rounded-lg border text-xs font-bold ${statusBadgeColor}`}>
                {statusText}
              </span>
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Clock size={12} />
                {hoursAgo}h ago
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium text-gray-700">
                <span>Progression Score</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-brand-600 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-600 pt-1 border-t border-gray-200/60">
              <span>Engagement Rate</span>
              <span className="font-bold text-brand-600">{engagementRate}%</span>
            </div>
          </div>

          {/* Breakdown Grid */}
          <h4 className="text-sm font-bold text-gray-900 pt-1">Interactions Breakdown</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-gray-200 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                <Eye size={18} />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 leading-none">{viewCount}</p>
                <p className="text-xs text-gray-500 mt-0.5">24h Views</p>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-gray-200 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
                <Users size={18} />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 leading-none">{viewers.length > 0 ? viewers.length : viewCount}</p>
                <p className="text-xs text-gray-500 mt-0.5">Unique Viewers</p>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-gray-200 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
                <Heart size={18} />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 leading-none">{likeCount}</p>
                <p className="text-xs text-gray-500 mt-0.5">Likes</p>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-gray-200 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
                <MessageCircle size={18} />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 leading-none">{commentCount}</p>
                <p className="text-xs text-gray-500 mt-0.5">Comments</p>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-gray-200 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                <Repeat size={18} />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 leading-none">{repostCount}</p>
                <p className="text-xs text-gray-500 mt-0.5">Reposts</p>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-gray-200 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                <Bookmark size={18} />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 leading-none">{bookmarkCount}</p>
                <p className="text-xs text-gray-500 mt-0.5">Bookmarks</p>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-gray-200 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                <Share2 size={18} />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 leading-none">{shareCount}</p>
                <p className="text-xs text-gray-500 mt-0.5">Shares</p>
              </div>
            </div>
          </div>

          {/* Viewer Profile List Section */}
          <div className="pt-2">
            {isAuthor ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                    <Users size={16} className="text-brand-600" />
                    <span>Viewers List</span>
                  </h4>
                  <span className="text-[11px] text-gray-400 font-medium">Author Only</span>
                </div>

                {loadingViewers ? (
                  <div className="py-6 text-center text-xs text-gray-400">Loading viewers...</div>
                ) : viewers.length === 0 ? (
                  <div className="p-4 bg-gray-50 rounded-xl text-center text-xs text-gray-500 border border-gray-200/80">
                    No unique 24h viewers recorded yet.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {viewers.map((v, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 border border-gray-100">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center font-bold text-brand-600 text-xs">
                            {v.viewer?.avatar_url ? (
                              <Image src={v.viewer.avatar_url} alt="" width={32} height={32} className="rounded-full object-cover" />
                            ) : (
                              (v.viewer?.display_name || 'U').charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-gray-900 leading-tight">
                              {v.viewer?.display_name || 'Anonymous User'}
                            </p>
                            <p className="text-[11px] text-gray-400">@{v.viewer?.username || 'user'}</p>
                          </div>
                        </div>
                        <span className="text-[10px] text-gray-400 font-medium">
                          {new Date(v.viewed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Non-Author Privacy Protection Notice */
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 text-xs text-gray-600 space-y-1 flex items-start gap-2.5">
                <Lock size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-gray-800">Viewer Privacy Protected</p>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    Viewer profiles and breakdown lists are strictly author-only on Private Voices. Public counts exclude author views.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Growth Tip */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-700">
              <Award size={16} />
              <span>Growth Tip</span>
            </div>
            <p className="leading-relaxed text-amber-800">
              Replying to comments on your Voice boosts algorithm recommendation ranking by up to 2.5x!
            </p>
          </div>
        </div>

        <button onClick={onClose} className="btn-primary w-full py-2.5 text-xs font-bold">
          Close
        </button>
      </div>
    </div>
  )
}
