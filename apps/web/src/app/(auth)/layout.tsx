import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign in',
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-600 mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.48 2 2 6.48 2 12C2 14.05 2.61 15.96 3.65 17.56L2 22L6.44 20.35C8.04 21.39 9.95 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2Z" fill="white"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Private Voices</h1>
          <p className="text-sm text-gray-500 mt-1">Speak freely. Stay private.</p>
        </div>

        <div className="card p-8">
          {children}
        </div>
      </div>
    </div>
  )
}
