import type { Metadata } from 'next'
import Link from 'next/link'
import { Trash2, AlertTriangle, ShieldCheck, ArrowLeft, Mail } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Delete Account & Data Deletion | Private Voices',
  description: 'Instructions and requirements for requesting permanent deletion of your Private Voices account and associated personal data.',
}

export default function DeleteAccountPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center space-x-3">
          <Link
            href="/"
            className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white">
              <Trash2 size={18} />
            </div>
            <span className="font-bold text-lg text-slate-900 dark:text-white">Private Voices</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 sm:p-10 shadow-sm border border-slate-200 dark:border-slate-800 space-y-6">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Account & Data Deletion
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              Public disclosure and self-service instructions required by Google Play & Apple App Store
            </p>
          </div>

          <div className="space-y-6 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 flex items-start space-x-3">
              <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />
              <p className="text-xs text-amber-900 dark:text-amber-300">
                Deleting your account is permanent and irreversible. All personal information, audio recordings, published posts, and chat histories will be permanently removed.
              </p>
            </div>

            <section className="space-y-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Method 1: Instant In-App Deletion (Recommended)
              </h2>
              <p>
                You can delete your account instantly at any time directly through the application:
              </p>
              <ol className="list-decimal pl-5 space-y-1.5 text-xs">
                <li>Open the <strong>Private Voices</strong> app (iOS, Android, or Web).</li>
                <li>Navigate to your <strong>Profile</strong> tab and tap <strong>Settings</strong>.</li>
                <li>Scroll to the bottom of the Settings page and select <strong>Delete Account</strong>.</li>
                <li>Read the confirmation disclosure and type <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono font-bold text-red-600">DELETE</code> to verify your identity.</li>
                <li>Tap <strong>Confirm Permanent Deletion</strong>. Your account and all associated records are purged immediately.</li>
              </ol>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Method 2: Email Deletion Request
              </h2>
              <p>
                If you no longer have access to your mobile device or account password, you may submit a manual data deletion request to our privacy compliance team:
              </p>
              <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs space-y-1.5">
                <p><strong>Email:</strong> <span className="font-mono text-indigo-600 dark:text-indigo-400">privacy@privatevoices.app</span></p>
                <p><strong>Subject:</strong> Account & Data Deletion Request</p>
                <p><strong>Required Details:</strong> Registered username and email address associated with the account.</p>
              </div>
              <p className="text-xs text-slate-500">
                Manual deletion requests are processed and confirmed within 48 hours of verification.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <ShieldCheck size={16} className="text-emerald-500" />
                <span>What Data is Deleted?</span>
              </h2>
              <ul className="list-disc pl-5 space-y-1 text-xs">
                <li>Your profile credentials, email, username, display name, and avatar image.</li>
                <li>All published voice notes, audio files, attached photos, and posts.</li>
                <li>Direct messaging threads, received whispers, comments, and reaction records.</li>
                <li>Device push notification tokens and active authentication session tokens.</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
