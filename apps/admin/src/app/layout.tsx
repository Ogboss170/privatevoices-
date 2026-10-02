import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Private Voices — Admin Console',
  description: 'Dedicated administration, moderation, and safety management console.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  )
}
