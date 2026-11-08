import type { Metadata } from 'next'
import './globals.css'
import { WebThemeProvider } from '@/context/WebThemeContext'
import { AudioPlayerProvider } from '@/context/AudioPlayerContext'
import { ActiveSpaceProvider } from '@/context/ActiveSpaceContext'
import { GlobalStickyAudioPlayer } from '@/components/common/GlobalStickyAudioPlayer'
import { GlobalSpaceMiniPlayer } from '@/components/spaces/GlobalSpaceMiniPlayer'
import { GlobalLiveSpaceModal } from '@/components/spaces/GlobalLiveSpaceModal'

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
            <ActiveSpaceProvider>
              {children}
              <GlobalStickyAudioPlayer />
              <GlobalSpaceMiniPlayer />
              <GlobalLiveSpaceModal />
            </ActiveSpaceProvider>
          </AudioPlayerProvider>
        </WebThemeProvider>
      </body>
    </html>
  )
}
