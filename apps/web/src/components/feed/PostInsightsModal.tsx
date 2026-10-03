'use client'

import React from 'react'
import { X, TrendingUp, Heart, MessageCircle, Bookmark, Award, Zap, Clock } from 'lucide-react'
import type { Post } from '@private-voices/shared'

interface PostInsightsModalProps {
  post: Post
  onClose: () => void
}

export default function PostInsightsModal({ post, onClose }: PostInsightsModalProps): React.JSX.Element {
  const likeCount = post.likeCount || 0
  const commentCount = post.commentCount || 0
  const totalEngagement = likeCount + commentCount
  const pollVotes = post.poll?.totalVotes || 0

  let statusText = 'Fresh Voice'
  let statusBadgeColor = 'bg-blue-500/10 text-blue-500 border-blue-500/30'
  let progressPercent = 20

  if (totalEngagement > 25) {
    statusText = '🔥 Trending & Viral'
    statusBadgeColor = 'bg-red-500/10 text-red-500 border-red-500/30'
    progressPercent = 95
  } else if (totalEngagement > 10) {
    statusText = '🚀 High Engagement'
    statusBadgeColor = 'bg-purple-500/10 text-purple-500 border-purple-500/30'
    progressPercent = 75
  } else if (totalEngagement > 3) {
    statusText = '📈 Rising Voice'
    statusBadgeColor = 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
    progressPercent = 50
  }

  const createdDate = new Date(post.createdAt)
  const hoursAgo = Math.max(1, Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60)))

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 relative max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <TrendingUp size={20} className="text-brand-600" />
            <h3 className="text-lg font-bold text-gray-900">Post Progression & Insights</h3>
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

            <p className="text-xs text-gray-500 leading-relaxed">
              {totalEngagement} total interactions ({likeCount} likes, {commentCount} comments, {pollVotes} poll votes).
            </p>
          </div>

          {/* Breakdown Grid */}
          <h4 className="text-sm font-bold text-gray-900 pt-1">Interactions Breakdown</h4>
          <div className="grid grid-cols-2 gap-3">
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
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                <Bookmark size={18} />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 leading-none">{post.isSavedByMe ? 1 : 0}</p>
                <p className="text-xs text-gray-500 mt-0.5">Bookmarks</p>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-gray-200 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                <Zap size={18} />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 leading-none">{pollVotes}</p>
                <p className="text-xs text-gray-500 mt-0.5">Poll Votes</p>
              </div>
            </div>
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
