import type { Metadata } from 'next'
import './globals.css'
import { WebThemeProvider } from '@/context/WebThemeContext'

export const metadata: Metadata = {
  title: {
    default: 'Private Voices',
    template: '%s | Private Voices',
  },
  description: 'Express yourself. Connect with people. Speak freely — with privacy at the center.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://privatevoices.app'),
  openGraph: {
    siteName: 'Private Voices',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <WebThemeProvider>
          {children}
        </WebThemeProvider>
      </body>
    </html>
  )
}
