// ==============================================================================
// Private Voices Offline Audio Cache Utility
// Handles local Cache API caching, offline availability checking, and preloading
// ==============================================================================

const AUDIO_CACHE_NAME = 'pv-audio-cache-v1'

/**
 * Checks if an audio URL is already stored in the browser's CacheStorage
 */
export async function isAudioCached(url: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window) || !url) return false
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME)
    const match = await cache.match(url)
    return !!match
  } catch {
    return false
  }
}

/**
 * Explicitly pre-caches an audio note URL into CacheStorage so it plays offline
 */
export async function cacheAudioForOffline(url: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window) || !url) return false
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME)
    const existing = await cache.match(url)
    if (existing) return true

    // Fetch and cache with CORS safety
    const response = await fetch(url, { mode: 'cors' })
    if (response && (response.status === 200 || response.type === 'opaque')) {
      await cache.put(url, response.clone())
      return true
    }
    return false
  } catch (err) {
    console.warn('Failed to pre-cache audio note for offline playback:', err)
    return false
  }
}

/**
 * Returns a playable Blob URL from the CacheStorage if available, otherwise returns the original URL
 */
export async function getPlayableAudioUrl(url: string): Promise<string> {
  if (typeof window === 'undefined' || !('caches' in window) || !url) return url
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME)
    const match = await cache.match(url)
    if (match) {
      const blob = await match.blob()
      if (blob && blob.size > 0) {
        return URL.createObjectURL(blob)
      }
    }
  } catch (err) {
    console.warn('Could not retrieve cached audio blob:', err)
  }
  return url
}
