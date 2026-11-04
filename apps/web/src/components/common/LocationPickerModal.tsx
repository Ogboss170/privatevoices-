'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Search, MapPin, Navigation, X, Loader2, Compass, AlertCircle } from 'lucide-react'
import type { LocationPlace } from '@private-voices/shared'

interface LocationPickerModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectLocation: (place: LocationPlace) => void
  initialSelected?: LocationPlace | null
}

export function LocationPickerModal({
  isOpen,
  onClose,
  onSelectLocation,
  initialSelected,
}: LocationPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState<LocationPlace[]>([])
  const [loading, setLoading] = useState(false)
  const [locatingUser, setLocatingUser] = useState(false)
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('')
      setResults([])
      setPermissionError(null)
      return
    }

    // Default suggestions when opened
    loadTrendingPlaces()
  }, [isOpen])

  function loadTrendingPlaces() {
    setResults([
      {
        placeId: 'loc_london',
        name: 'London',
        city: 'London',
        country: 'United Kingdom',
        countryCode: 'GB',
        category: 'city',
        latitude: 51.507,
        longitude: -0.128,
      },
      {
        placeId: 'loc_paris',
        name: 'Paris',
        city: 'Paris',
        country: 'France',
        countryCode: 'FR',
        category: 'city',
        latitude: 48.857,
        longitude: 2.352,
      },
      {
        placeId: 'loc_tokyo',
        name: 'Tokyo',
        city: 'Tokyo',
        country: 'Japan',
        countryCode: 'JP',
        category: 'city',
        latitude: 35.676,
        longitude: 139.65,
      },
      {
        placeId: 'loc_newyork',
        name: 'New York',
        city: 'New York',
        region: 'New York',
        country: 'United States',
        countryCode: 'US',
        category: 'city',
        latitude: 40.713,
        longitude: -74.006,
      },
      {
        placeId: 'loc_lagos',
        name: 'Lagos',
        city: 'Lagos',
        country: 'Nigeria',
        countryCode: 'NG',
        category: 'city',
        latitude: 6.524,
        longitude: 3.379,
      },
    ])
  }

  // Handle typing search with debounce
  function handleSearchChange(text: string) {
    setSearchQuery(text)
    setPermissionError(null)

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)

    if (!text.trim()) {
      loadTrendingPlaces()
      setLoading(false)
      return
    }

    setLoading(true)
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/location/search?q=${encodeURIComponent(text.trim())}`)
        if (res.ok) {
          const data = await res.json()
          setResults(data.places || [])
        } else {
          setResults([])
        }
      } catch (err) {
        console.error('Failed to search locations:', err)
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 350)
  }

  // Request Current Location (opt-in explicit permission)
  function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setPermissionError('Geolocation is not supported by your browser.')
      return
    }

    setLocatingUser(true)
    setPermissionError(null)

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude
          const lng = pos.coords.longitude

          // Convert coordinates into coarse place name via server-side reverse geocoding
          const res = await fetch(`/api/location/search?lat=${lat}&lng=${lng}`)
          if (res.ok) {
            const data = await res.json()
            if (data.places && data.places.length > 0) {
              setResults(data.places)
            } else {
              setPermissionError('Could not identify a city or landmark for your current coordinates.')
            }
          } else {
            setPermissionError('Failed to lookup current location place.')
          }
        } catch (err) {
          console.error('Error reverse geocoding current location:', err)
          setPermissionError('Could not retrieve place name for your location.')
        } finally {
          setLocatingUser(false)
        }
      },
      (err) => {
        setLocatingUser(false)
        if (err.code === err.PERMISSION_DENIED) {
          setPermissionError('Location permission was denied. You can still search for any city or venue manually.')
        } else if (err.code === err.TIMEOUT) {
          setPermissionError('Location request timed out. Please try searching manually.')
        } else {
          setPermissionError('Unable to detect current position. Please search manually.')
        }
      },
      { timeout: 10000, enableHighAccuracy: false } // Avoid high accuracy to protect battery and residential privacy
    )
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-brand-50 dark:bg-slate-800 flex items-center justify-center text-brand-600 dark:text-brand-400">
              <MapPin size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Add Location</h3>
              <p className="text-[11px] text-gray-400">Find cities, venues, or landmarks</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search input bar */}
        <div className="p-4 border-b border-gray-100 dark:border-slate-800/80 space-y-2">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search places, cities, neighborhoods..."
              className="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-gray-50 dark:bg-slate-800/70 border border-gray-200 dark:border-slate-700/80 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => handleSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Current location button */}
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={locatingUser}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 hover:bg-purple-100/70 dark:hover:bg-purple-950/40 font-semibold text-xs transition-colors border border-purple-200/50 dark:border-purple-800/40"
          >
            {locatingUser ? (
              <Loader2 size={15} className="animate-spin text-purple-600" />
            ) : (
              <Navigation size={15} className="text-purple-600 dark:text-purple-400" />
            )}
            <span className="flex-1 text-left">
              {locatingUser ? 'Finding nearby places...' : 'Use current location'}
            </span>
            <span className="text-[10px] text-purple-500 font-normal">GPS</span>
          </button>

          {/* Privacy Note & Permission Notice */}
          <div className="text-[10px] text-gray-400 dark:text-gray-500 px-1 leading-tight flex items-start gap-1">
            <Compass size={12} className="shrink-0 mt-0.5 text-gray-400" />
            <span>
              Your exact GPS coordinates are never made public. Only the selected city or place name is tagged.
            </span>
          </div>

          {permissionError && (
            <div className="flex items-center gap-1.5 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-xs">
              <AlertCircle size={14} className="shrink-0" />
              <span>{permissionError}</span>
            </div>
          )}
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800/60 p-2">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-gray-400 gap-2">
              <Loader2 size={24} className="animate-spin text-brand-500" />
              <span className="text-xs">Searching places...</span>
            </div>
          ) : results.length > 0 ? (
            results.map((place) => {
              const isSelected = initialSelected?.placeId === place.placeId
              return (
                <button
                  key={place.placeId}
                  type="button"
                  onClick={() => {
                    onSelectLocation(place)
                    onClose()
                  }}
                  className={`w-full text-left p-3 rounded-2xl flex items-center gap-3 transition-colors ${
                    isSelected
                      ? 'bg-brand-50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-800'
                      : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-gray-500 dark:text-gray-300 shrink-0">
                    <MapPin size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
                        {place.name}
                      </span>
                      {place.category && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 uppercase tracking-wider font-mono">
                          {place.category}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 dark:text-gray-400 truncate">
                      {[place.city, place.region, place.country].filter(Boolean).join(', ')}
                    </p>
                  </div>
                </button>
              )
            })
          ) : (
            <div className="py-12 text-center text-gray-400 space-y-1">
              <p className="text-xs font-semibold">No places found</p>
              <p className="text-[11px]">Try searching by city name or a nearby landmark</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
