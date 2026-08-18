/**
 * geo.ts — Geolocation utilities
 */

/**
 * Haversine distance between two GPS coordinates.
 * Returns distance in **metres**.
 */
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6_371_000 // Earth radius in metres
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Get the device's GPS position as a Promise.
 * Resolves with { lat, lng } or rejects with a human-readable error string.
 */
export function getGPSPosition(timeoutMs = 10_000): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject('Geolocation is not supported by this browser.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            reject('Location permission denied. Please allow location access and try again.')
            break
          case err.POSITION_UNAVAILABLE:
            reject('Location unavailable. Check your device GPS settings.')
            break
          case err.TIMEOUT:
            reject('Location request timed out. Try again in a moment.')
            break
          default:
            reject('Could not get your location.')
        }
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    )
  })
}
