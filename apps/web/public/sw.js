// ==============================================================================
// Private Voices Service Worker: Audio Caching & Offline Sync
// ==============================================================================

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
self.addEventListener('install', (event) => {
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
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== STATIC_CACHE_NAME) {
            return caches.delete(key)
          }
        })
      )
    })
  )
  self.clients.claim()
})

// Fetch event: Network-First with static cache fallback
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(event.request)
      return cached || new Response('Offline', { status: 503 })
    })
  )
})

// Background sync for queued offline whispers
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-whispers') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'TRIGGER_OFFLINE_SYNC' })
        })
      })
    )
  }
})
