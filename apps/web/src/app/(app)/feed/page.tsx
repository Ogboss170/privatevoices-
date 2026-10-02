import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Feed' }

export default function FeedPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Home</h1>

      {/* Feed tabs — Phase 2 will make these functional */}
      <div className="flex gap-1 border-b border-gray-200">
        {['For You', 'Following', 'Trending', 'Latest'].map((tab) => (
          <button
            key={tab}
            className="px-4 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-900 border-b-2 border-transparent hover:border-brand-500 transition-colors first:text-brand-600 first:border-brand-600"
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Empty state — Phase 2 will populate this */}
      <div className="card p-12 text-center">
        <div className="text-5xl mb-4">✨</div>
        <h2 className="font-semibold text-gray-900 mb-1">Your feed is ready</h2>
        <p className="text-sm text-gray-500 max-w-xs mx-auto">
          Follow people and join communities to start seeing posts here. Posts are coming in Phase 2.
        </p>
      </div>
    </div>
  )
}
