import { NextResponse } from 'next/server'

interface NominatimPlace {
  place_id: number | string
  osm_id?: number | string
  display_name: string
  name?: string
  lat: string
  lon: string
  type?: string
  class?: string
  address?: {
    city?: string
    town?: string
    village?: string
    suburb?: string
    neighbourhood?: string
    state?: string
    country?: string
    country_code?: string
    building?: string
    amenity?: string
    road?: string
  }
}

/**
 * Clean and coarse-grain place data to protect exact residential addresses
 */
function sanitizePlace(raw: NominatimPlace) {
  const addr = raw.address || {}
  
  // Choose best primary display name
  let name = raw.name || addr.amenity || addr.building || addr.neighbourhood || addr.suburb || addr.city || addr.town || ''
  
  if (!name) {
    const parts = (raw.display_name || '').split(',')
    name = parts[0]?.trim() || 'Selected Location'
  }

  // Prevent exposing exact house numbers or specific street addresses
  // If the place is a residential house or road number, generalize to neighbourhood or city
  if (raw.type === 'house' || raw.class === 'place' && /isolated_dwelling|house/i.test(raw.type || '')) {
    name = addr.neighbourhood || addr.suburb || addr.city || addr.town || 'Nearby Area'
  }

  const city = addr.city || addr.town || addr.village || addr.suburb || null
  const region = addr.state || null
  const country = addr.country || null
  const countryCode = addr.country_code ? addr.country_code.toUpperCase() : null
  const category = raw.type || raw.class || 'place'

  // Round coordinates to 3 decimal places (~110 meters) so exact home coordinates are never stored
  const latNum = parseFloat(raw.lat)
  const lngNum = parseFloat(raw.lon)
  const coarseLat = !isNaN(latNum) ? Math.round(latNum * 1000) / 1000 : null
  const coarseLng = !isNaN(lngNum) ? Math.round(lngNum * 1000) / 1000 : null

  const placeId = String(raw.place_id || raw.osm_id || `${coarseLat}_${coarseLng}_${name}`)

  return {
    placeId,
    name: name.slice(0, 100),
    city,
    region,
    country,
    countryCode,
    category,
    latitude: coarseLat,
    longitude: coarseLng,
    displayName: raw.display_name,
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim()
    const lat = searchParams.get('lat')
    const lng = searchParams.get('lng')

    const userAgent = 'PrivateVoices-LocationService/1.0 (contact@privatevoices.app)'

    // Case 1: Reverse Geocoding from user's explicit Current Location (lat, lng)
    if (lat && lng) {
      const latNum = parseFloat(lat)
      const lngNum = parseFloat(lng)

      if (isNaN(latNum) || isNaN(lngNum)) {
        return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 })
      }

      // Query OpenStreetMap Nominatim reverse endpoint
      const reverseUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(latNum)}&lon=${encodeURIComponent(lngNum)}&zoom=16&addressdetails=1`

      const res = await fetch(reverseUrl, {
        headers: {
          'User-Agent': userAgent,
          'Accept-Language': 'en',
        },
        next: { revalidate: 300 }, // Cache reverse lookups for 5 minutes
      })

      if (!res.ok) {
        return NextResponse.json({ places: [] })
      }

      const rawPlace: NominatimPlace = await res.json()
      if (!rawPlace || (!rawPlace.name && !rawPlace.display_name)) {
        return NextResponse.json({ places: [] })
      }

      const sanitized = sanitizePlace(rawPlace)
      return NextResponse.json({ places: [sanitized] })
    }

    // Case 2: Text Search for cities, landmarks, venues, neighborhoods
    if (!query) {
      return NextResponse.json({ places: [] })
    }

    const searchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10&addressdetails=1`

    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': userAgent,
        'Accept-Language': 'en',
      },
      next: { revalidate: 300 },
    })

    if (!res.ok) {
      return NextResponse.json({ places: [] })
    }

    const rawPlaces: NominatimPlace[] = await res.json()
    if (!Array.isArray(rawPlaces)) {
      return NextResponse.json({ places: [] })
    }

    const places = rawPlaces.map(sanitizePlace)

    // Deduplicate by placeId or unique name + city
    const seen = new Set<string>()
    const deduplicated = places.filter((p) => {
      const key = `${p.name}_${p.city || ''}_${p.country || ''}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    return NextResponse.json({ places: deduplicated })
  } catch (err: any) {
    console.error('Location search API error:', err)
    return NextResponse.json({ error: 'Failed to search location', places: [] }, { status: 500 })
  }
}
