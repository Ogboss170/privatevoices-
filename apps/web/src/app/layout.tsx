import type { Metadata } from 'next'
import './globals.css'
import { WebThemeProvider } from '@/context/WebThemeContext'
import { AudioPlayerProvider } from '@/context/AudioPlayerContext'
import { GlobalStickyAudioPlayer } from '@/components/common/GlobalStickyAudioPlayer'

export const metadata: Metadata = {
  title: {
    default: 'Private Voices',
    template: '%s | Private Voices',
  },
  description: 'Express yourself. Connect with people. Speak freely — with privacy at the center.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://privatevoices.app'),
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/icon-192.png',
  },
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
          <AudioPlayerProvider>
            {children}
            <GlobalStickyAudioPlayer />
          </AudioPlayerProvider>
        </WebThemeProvider>
      </body>
    </html>
  )
}
