// ==============================================================================
// Private Voices Service Worker: Audio Caching & Offline Sync
// ==============================================================================

const CACHE_NAME = 'pv-audio-cache-v1'
const STATIC_CACHE_NAME = 'pv-static-assets-v1'

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/sounds/incoming_call.mp3',
  '/sounds/outgoing_ring.mp3',
  '/sounds/message_sent.mp3',
  '/sounds/message_received.mp3',
  '/sounds/whisper_sent.mp3',
]

// Install Service Worker
self.addEventListener('install', (event: any) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Failed to precache static assets:', err)
      })
    })
  )
  self.skipWaiting()
})

// Activate and remove old caches
self.addEventListener('activate', (event: any) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== STATIC_CACHE_NAME) {
            return caches.delete(key)
          }
        })
      )
    })
  )
  self.clients.claim()
})

// Fetch event: Cache-First for audio notes, Network-First for other requests
self.addEventListener('fetch', (event: any) => {
  const url = new URL(event.request.url)

  // Cache audio notes & sounds (mp3, wav, ogg, webm, m4a, audio/*)
  const isAudio =
    url.pathname.endsWith('.mp3') ||
    url.pathname.endsWith('.wav') ||
    url.pathname.endsWith('.ogg') ||
    url.pathname.endsWith('.webm') ||
    url.pathname.endsWith('.m4a') ||
    url.pathname.includes('/storage/v1/object/public/whispers') ||
    url.pathname.includes('/storage/v1/object/public/chat_audio') ||
    url.pathname.includes('/storage/v1/object/public/post_audio') ||
    event.request.headers.get('accept')?.includes('audio/')

  if (isAudio) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(event.request)
        if (cachedResponse) {
          return cachedResponse
        }

        try {
          const networkResponse = await fetch(event.request)
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone())
          }
          return networkResponse
        } catch (fetchErr) {
          // If offline and not in cache, fallback
          return cachedResponse || new Response('Audio unavailable offline', { status: 503 })
        }
      })
    )
    return
  }

  // Regular requests
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(event.request)
      return cached || new Response('Offline', { status: 503 })
    })
  )
})

// Background sync for queued offline whispers
self.addEventListener('sync', (event: any) => {
  if (event.tag === 'sync-offline-whispers') {
    event.waitUntil(
      (self as any).clients.matchAll().then((clients: any[]) => {
        clients.forEach((client: any) => {
          client.postMessage({ type: 'TRIGGER_OFFLINE_SYNC' })
        })
      })
    )
  }
})
