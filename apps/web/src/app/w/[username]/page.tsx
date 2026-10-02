import { Metadata } from 'next'
import PublicWhisperForm from './PublicWhisperForm'
import { createSupabaseServerClient } from '@/lib/supabase/server'

interface PageProps {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params
  const rawUsername = decodeURIComponent(resolvedParams.username)
  const cleanUsername = rawUsername.replace(/^@/, '')

  const title = `Send an Anonymous Whisper to @${cleanUsername} | Private Voices`
  const description = `Receive honest thoughts from people around you — anonymously.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'Private Voices',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

export default async function PublicWhisperPage({ params }: PageProps) {
  const resolvedParams = await params
  const rawUsername = decodeURIComponent(resolvedParams.username)
  const cleanUsername = rawUsername.replace(/^@/, '')

  // Fetch recipient public profile server-side
  const supabase = await createSupabaseServerClient()
  const { data: recipient } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, bio')
    .ilike('username', cleanUsername)
    .maybeSingle()

  let whisperVisibility = 'anyone'
  if (recipient) {
    const { data: priv } = await supabase
      .from('privacy_settings')
      .select('whisper_visibility')
      .eq('user_id', recipient.id)
      .maybeSingle()
    if (priv?.whisper_visibility) {
      whisperVisibility = priv.whisper_visibility
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 via-slate-900 to-black text-white flex flex-col justify-between p-4 sm:p-6">
      <header className="max-w-md mx-auto w-full pt-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-2xl">🤫</span>
          <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Private Voices
          </span>
        </div>
        <span className="text-xs px-2.5 py-1 bg-white/10 backdrop-blur-md rounded-full text-purple-200 border border-white/10 font-medium">
          Anonymous Whispers
        </span>
      </header>

      <main className="max-w-md mx-auto w-full py-8 my-auto">
        <PublicWhisperForm
          recipient={recipient}
          cleanUsername={cleanUsername}
          whisperVisibility={whisperVisibility}
        />
      </main>

      <footer className="max-w-md mx-auto w-full pb-4 text-center space-y-2">
        <p className="text-xs text-gray-400">
          Someone has something to say. Let them say it.
        </p>
        <p className="text-[11px] text-gray-500">
          Private Voices &copy; {new Date().getFullYear()} &bull; Identity Protection Enabled
        </p>
      </footer>
    </div>
  )
}
