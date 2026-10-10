import type { Metadata } from 'next'
import Link from 'next/link'
import { FileText, ArrowLeft, CheckCircle2 } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Terms of Service | Private Voices',
  description: 'Review the Terms of Service governing usage of the Private Voices mobile and web platforms.',
}

export default function TermsOfServicePage() {
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
              <FileText size={18} />
            </div>
            <span className="font-bold text-lg text-slate-900 dark:text-white">Private Voices</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 sm:p-10 shadow-sm border border-slate-200 dark:border-slate-800 space-y-6">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Terms of Service
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              Last updated: October 10, 2026 • Effective Date: October 10, 2026
            </p>
          </div>

          <div className="prose dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <section className="space-y-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <CheckCircle2 size={16} className="text-emerald-500" />
                <span>1. Acceptance of Terms</span>
              </h2>
              <p>
                By creating an account or accessing Private Voices across mobile applications (iOS/Android) or our web interface, you agree to comply with and be legally bound by these Terms of Service.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">2. User Conduct & Acceptable Use</h2>
              <p>
                Private Voices fosters authentic and safe expression. Users agree not to:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Harass, stalk, threaten, impersonate, or intimidate other users.</li>
                <li>Transmit illegal, abusive, defamation, or infringing content.</li>
                <li>Engage in automated scraping, spamming, bot creation, or malicious activity.</li>
                <li>Circumvent or tamper with security protocols, rate limiters, or whisper anonymization protections.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">3. Content Ownership & Rights</h2>
              <p>
                You retain complete intellectual property ownership over the content and voice recordings you publish on Private Voices. By publishing public content, you grant Private Voices a limited, non-exclusive license solely to host, display, and stream your content to users within the platform.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">4. Account Termination</h2>
              <p>
                You may terminate your account at any time via <strong>Settings &rarr; Delete Account</strong>. We reserve the right to suspend or terminate accounts that repeatedly violate community safety policies.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">5. Contact Information</h2>
              <p>
                For legal inquiries or copyright notices, contact: <span className="font-semibold text-slate-800 dark:text-slate-200">legal@privatevoices.app</span>.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
