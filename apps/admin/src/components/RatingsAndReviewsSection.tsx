'use client'

import React, { useState } from 'react'
import {
  Star,
  Filter,
  CheckCircle2,
  AlertTriangle,
  EyeOff,
  Download,
  Calendar,
  Smartphone,
  Globe,
  RefreshCw,
  Search,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react'
import type { AppRatingRecord, AppRatingSummary } from '@private-voices/shared'

interface RatingsAndReviewsSectionProps {
  ratings: (AppRatingRecord & { user?: { username: string; display_name: string } })[]
  summary: AppRatingSummary | null
  loading: boolean
  onRefresh: () => void
  onUpdateStatus: (ratingId: string, status: 'published' | 'reviewed' | 'flagged' | 'hidden', adminNotes?: string) => Promise<boolean>
}

export function RatingsAndReviewsSection({
  ratings,
  summary,
  loading,
  onRefresh,
  onUpdateStatus,
}: RatingsAndReviewsSectionProps) {
  const [filterRating, setFilterRating] = useState<number | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Filtered ratings
  const filteredRatings = ratings.filter((r) => {
    if (filterRating !== 'all' && r.rating !== filterRating) return false
    if (filterStatus !== 'all' && r.status !== filterStatus) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const textMatch = r.review?.toLowerCase().includes(q)
      const userMatch = r.user?.username.toLowerCase().includes(q) || r.user?.display_name.toLowerCase().includes(q)
      if (!textMatch && !userMatch) return false
    }
    return true
  })

  const handleStatusChange = async (
    id: string,
    newStatus: 'published' | 'reviewed' | 'flagged' | 'hidden'
  ) => {
    setActionLoading(id)
    await onUpdateStatus(id, newStatus)
    setActionLoading(null)
  }

  const exportToCSV = () => {
    if (!ratings.length) return
    const headers = ['ID', 'User', 'Is Anonymous', 'Rating', 'Review', 'Platform', 'App Version', 'Status', 'Date']
    const rows = filteredRatings.map((r) => [
      r.id,
      r.is_anonymous ? 'Anonymous' : (r.user?.username ? `@${r.user.username}` : r.user_id || 'Unknown'),
      r.is_anonymous ? 'Yes' : 'No',
      r.rating,
      `"${(r.review || '').replace(/"/g, '""')}"`,
      r.platform,
      r.app_version,
      r.status,
      r.created_at,
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `private_voices_app_ratings_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const average = summary ? (summary.averageRating ?? summary.average_rating ?? 0) : (ratings.length ? (ratings.reduce((acc, c) => acc + c.rating, 0) / ratings.length) : 0)
  const total = summary ? (summary.totalReviews ?? summary.total_count ?? ratings.length) : ratings.length

  return (
    <div className="space-y-6">
      {/* Top Summary Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Overall Rating Card */}
        <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase">Overall Rating</span>
            <div className="flex items-center text-amber-400">
              <Star size={14} className="fill-amber-400" />
            </div>
          </div>
          <div className="my-2">
            <span className="text-3xl font-extrabold text-white">{average.toFixed(1)}</span>
            <span className="text-slate-400 text-sm font-medium"> / 5.0</span>
          </div>
          <p className="text-[11px] text-slate-400">Based on {total} genuine submissions</p>
        </div>

        {/* Breakdown Card */}
        <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl md:col-span-2">
          <span className="text-xs font-semibold uppercase text-slate-400 block mb-2">Score Distribution</span>
          <div className="space-y-1">
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = summary?.distribution ? (summary.distribution[stars] || 0) : ratings.filter((r) => r.rating === stars).length
              const pct = total > 0 ? (count / total) * 100 : 0
              return (
                <div key={stars} className="flex items-center gap-2 text-xs">
                  <span className="w-4 font-bold text-slate-300 flex items-center gap-0.5">
                    {stars}<Star size={9} className="fill-amber-400 text-amber-400" />
                  </span>
                  <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-[11px] text-slate-400 font-mono">{count}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Reviews with Comments */}
        <div className="bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase">Written Reviews</span>
            <MessageSquare size={14} className="text-purple-400" />
          </div>
          <div className="my-2">
            <span className="text-3xl font-extrabold text-white">
              {ratings.filter((r) => r.review && r.review.trim().length > 0).length}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">User suggestions & feedback</p>
        </div>
      </div>

      {/* Control Bar: Filters, Search & Export */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/40 p-4 rounded-2xl border border-slate-800/80">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Star Filter */}
          <div className="flex items-center gap-1 bg-slate-950 px-2 py-1.5 rounded-xl border border-slate-800">
            <Filter size={13} className="text-slate-500" />
            <select
              value={filterRating}
              onChange={(e) => setFilterRating(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="bg-transparent text-xs text-white outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900">All Stars</option>
              <option value="5" className="bg-slate-900">5 Stars</option>
              <option value="4" className="bg-slate-900">4 Stars</option>
              <option value="3" className="bg-slate-900">3 Stars</option>
              <option value="2" className="bg-slate-900">2 Stars</option>
              <option value="1" className="bg-slate-900">1 Star</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-950 px-2 py-1.5 rounded-xl border border-slate-800">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-transparent text-xs text-white outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900">All Statuses</option>
              <option value="published" className="bg-slate-900">Published</option>
              <option value="reviewed" className="bg-slate-900">Reviewed</option>
              <option value="flagged" className="bg-slate-900">Flagged</option>
              <option value="hidden" className="bg-slate-900">Hidden</option>
            </select>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" size={13} />
            <input
              type="text"
              placeholder="Search feedback text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={onRefresh}
            className="p-2 text-slate-400 hover:text-white bg-slate-950 hover:bg-slate-800 rounded-xl border border-slate-800 transition-colors"
            title="Refresh ratings"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={exportToCSV}
            disabled={!filteredRatings.length}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-xs font-semibold rounded-xl border border-purple-500/30 disabled:opacity-40 transition-colors"
          >
            <Download size={13} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Ratings Table / List */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-800/80">
            <tr>
              <th className="p-4">User & Platform</th>
              <th className="p-4">Rating</th>
              <th className="p-4">Written Feedback</th>
              <th className="p-4">Status</th>
              <th className="p-4">Date</th>
              <th className="p-4 text-right">Moderation Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredRatings.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500 font-mono">
                  No ratings found matching current filters.
                </td>
              </tr>
            ) : (
              filteredRatings.map((r) => (
                <tr key={r.id} className="hover:bg-slate-850/40 transition-colors">
                  {/* User & Platform */}
                  <td className="p-4 align-top">
                    <div className="space-y-1">
                      {r.is_anonymous ? (
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <EyeOff size={13} className="text-slate-500" />
                          <span className="font-semibold text-slate-300">Anonymous Voice</span>
                        </div>
                      ) : (
                        <div>
                          <span className="font-semibold text-white block">
                            {r.user?.display_name || 'Member'}
                          </span>
                          <span className="text-[11px] text-purple-400 font-mono">
                            @{r.user?.username || 'user'}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                        {r.platform === 'ios' || r.platform === 'android' ? (
                          <Smartphone size={10} />
                        ) : (
                          <Globe size={10} />
                        )}
                        <span className="uppercase">{r.platform}</span>
                        <span>&bull;</span>
                        <span>v{r.app_version}</span>
                      </div>
                    </div>
                  </td>

                  {/* Rating */}
                  <td className="p-4 align-top">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={13}
                          className={
                            star <= r.rating
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-slate-700'
                          }
                        />
                      ))}
                      <span className="text-xs font-bold text-white ml-1.5">{r.rating}.0</span>
                    </div>
                  </td>

                  {/* Feedback */}
                  <td className="p-4 align-top max-w-md">
                    {r.review && r.review.trim() ? (
                      <p className="text-xs text-slate-200 leading-relaxed break-words whitespace-pre-wrap">
                        {r.review}
                      </p>
                    ) : (
                      <span className="text-slate-600 italic text-[11px]">No written review</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="p-4 align-top">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                        r.status === 'published'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : r.status === 'reviewed'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : r.status === 'flagged'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>

                  {/* Date */}
                  <td className="p-4 align-top text-slate-400 font-mono text-[11px] whitespace-nowrap">
                    {r.created_at || r.createdAt ? new Date(r.created_at || r.createdAt || '').toLocaleDateString() : 'Recent'}
                  </td>

                  {/* Actions */}
                  <td className="p-4 align-top text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {r.status !== 'reviewed' && (
                        <button
                          onClick={() => handleStatusChange(r.id, 'reviewed')}
                          disabled={actionLoading === r.id}
                          className="px-2.5 py-1 bg-blue-950/40 hover:bg-blue-900/60 text-blue-300 rounded-lg border border-blue-800/40 text-[11px] font-medium transition-colors"
                          title="Mark Reviewed"
                        >
                          Mark Reviewed
                        </button>
                      )}
                      {r.status !== 'flagged' && (
                        <button
                          onClick={() => handleStatusChange(r.id, 'flagged')}
                          disabled={actionLoading === r.id}
                          className="px-2.5 py-1 bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 rounded-lg border border-amber-800/40 text-[11px] font-medium transition-colors"
                          title="Flag for review"
                        >
                          Flag
                        </button>
                      )}
                      {r.status !== 'hidden' ? (
                        <button
                          onClick={() => handleStatusChange(r.id, 'hidden')}
                          disabled={actionLoading === r.id}
                          className="px-2.5 py-1 bg-red-950/40 hover:bg-red-900/60 text-red-300 rounded-lg border border-red-800/40 text-[11px] font-medium transition-colors"
                          title="Hide from public view"
                        >
                          Hide
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStatusChange(r.id, 'published')}
                          disabled={actionLoading === r.id}
                          className="px-2.5 py-1 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 rounded-lg border border-emerald-800/40 text-[11px] font-medium transition-colors"
                          title="Republish"
                        >
                          Publish
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
