import type { Metadata } from 'next'
import Link from 'next/link'
import { Shield, Lock, Eye, Trash2, ArrowLeft } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Privacy Policy | Private Voices',
  description: 'Understand how Private Voices collects, uses, protects, and allows deletion of your personal data.',
}

export default function PrivacyPolicyPage() {
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
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <Shield size={18} />
            </div>
            <span className="font-bold text-lg text-slate-900 dark:text-white">Private Voices</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 sm:p-10 shadow-sm border border-slate-200 dark:border-slate-800 space-y-6">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Privacy Policy
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              Last updated: October 10, 2026 • Effective Date: October 10, 2026
            </p>
          </div>

          <div className="prose dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <section className="space-y-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Lock size={16} className="text-indigo-500" />
                <span>1. Overview & Privacy by Design</span>
              </h2>
              <p>
                Private Voices (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting your privacy and giving you complete sovereignty over your communications. Our platform incorporates end-to-end encryption principles for sensitive communications, transparent access controls, and strict anonymous whisper isolation.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Eye size={16} className="text-indigo-500" />
                <span>2. Information We Collect</span>
              </h2>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong>Account Information:</strong> Email address, username, display name, and avatar picture provided during registration.</li>
                <li><strong>User-Generated Content:</strong> Public audio and text posts (&quot;Voices&quot;), media attachments, comments, and direct messages.</li>
                <li><strong>Anonymous Whispers:</strong> When sending an anonymous whisper, the sender&apos;s identity is cryptographically disassociated from the message body. Neither recipients nor other members can view whisper author identities.</li>
                <li><strong>Push Tokens:</strong> Device push registration tokens (via Apple APNs and Google FCM through Expo) solely for delivering immediate notifications regarding direct messages, mentions, and replies.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Shield size={16} className="text-indigo-500" />
                <span>3. How We Use and Protect Data</span>
              </h2>
              <p>
                We do not sell, rent, or monetize your personal data or communications to advertisers. Information collected is used strictly to provide real-time messaging, post feeds, authentication, push notification delivery, and platform abuse prevention.
              </p>
            </section>

            <section className="space-y-3 bg-red-50 dark:bg-red-950/20 p-5 rounded-2xl border border-red-100 dark:border-red-900/40">
              <h2 className="text-base font-bold text-red-900 dark:text-red-300 flex items-center space-x-2">
                <Trash2 size={16} className="text-red-500" />
                <span>4. User Rights & Account Deletion Disclosure</span>
              </h2>
              <p className="text-xs text-red-800 dark:text-red-300">
                In compliance with Apple App Store Review Guidelines (Section 5.1.1) and Google Play User Data policies:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-xs text-red-800 dark:text-red-300">
                <li>You may initiate instantaneous and permanent account deletion directly within the mobile application or web portal via <strong>Settings &rarr; Delete Account</strong>.</li>
                <li>Alternatively, you may request complete account and data removal by visiting our dedicated <Link href="/delete-account" className="underline font-bold">Account Deletion Endpoint</Link> or contacting our Data Protection Officer at <span className="font-mono">privacy@privatevoices.app</span>.</li>
                <li>Upon confirmed deletion, all personal data, user profiles, published voices, direct chat messages, and stored audio clips are permanently purged from all production databases and storage buckets.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">5. Contact Information</h2>
              <p>
                If you have questions regarding this Privacy Policy or wish to exercise your data rights under GDPR or CCPA, contact us at:
              </p>
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                Email: privacy@privatevoices.app<br />
                Address: Private Voices Inc., Data Privacy & Security Team
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
