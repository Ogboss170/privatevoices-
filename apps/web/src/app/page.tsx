import Link from 'next/link'
import { Shield, MessageSquare, Users, Lock, ArrowRight, Sparkles } from 'lucide-react'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function LandingPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      {/* Header / Navbar */}
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-sm">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C6.48 2 2 6.48 2 12C2 14.05 2.61 15.96 3.65 17.56L2 22L6.44 20.35C8.04 21.39 9.95 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2Z" fill="white"/>
              </svg>
            </div>
            <span className="font-bold text-lg text-gray-900 tracking-tight">Private Voices</span>
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <Link href="/feed" className="btn-primary flex items-center gap-2 text-sm">
                <span>Go to Feed</span>
                <ArrowRight size={16} />
              </Link>
            ) : (
              <>
                <Link href="/login" className="btn-secondary text-sm px-4 py-2">
                  Sign In
                </Link>
                <Link href="/register" className="btn-primary text-sm px-4 py-2">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex-1 max-w-5xl mx-auto px-6 pt-20 pb-16 text-center flex flex-col items-center justify-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-xs font-semibold mb-6">
          <Sparkles size={14} />
          <span>Privacy-Focused Social Platform</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-extrabold text-gray-900 tracking-tight max-w-3xl leading-tight">
          Express yourself. Connect with people. <span className="text-brand-600">Speak freely.</span>
        </h1>

        <p className="mt-6 text-lg text-gray-600 max-w-2xl leading-relaxed">
          Private Voices combines conventional social networking with anonymous Whispers, giving you complete control over your identity and digital footprint.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <Link href="/register" className="btn-primary w-full sm:w-auto px-8 py-3.5 text-base shadow-lg shadow-brand-500/20">
            Create Your Account
          </Link>
          <Link href="/login" className="btn-secondary w-full sm:w-auto px-8 py-3.5 text-base">
            Sign In
          </Link>
        </div>

        {/* Feature Cards Grid */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 text-left w-full">
          <div className="card p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mb-4">
              <Shield size={20} />
            </div>
            <h3 className="font-bold text-gray-900 text-lg mb-2">Privacy at the Core</h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              Dedicated privacy center allowing fine-grained control over who can follow, message, or see your content.
            </p>
          </div>

          <div className="card p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mb-4">
              <MessageSquare size={20} />
            </div>
            <h3 className="font-bold text-gray-900 text-lg mb-2">Anonymous Whispers</h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              Receive messages directly without recipient identification while maintaining backend abuse prevention & safety.
            </p>
          </div>

          <div className="card p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mb-4">
              <Users size={20} />
            </div>
            <h3 className="font-bold text-gray-900 text-lg mb-2">Social Feed & Communities</h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              Share text posts, media, hashtags, and join topic-based communities with people who share your interests.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 bg-gray-50 text-center text-xs text-gray-400">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} Private Voices. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/login" className="hover:text-gray-600">Sign In</Link>
            <Link href="/register" className="hover:text-gray-600">Sign Up</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
