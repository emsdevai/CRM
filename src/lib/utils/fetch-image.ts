/**
 * Fetch an image URL server-side and return it as a base64 data URI.
 * This makes images work in printed PDFs without any browser auth or CORS issues.
 */
export async function fetchImageAsDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const buffer = await res.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const contentType = res.headers.get('content-type') ?? 'image/jpeg'
    return `data:${contentType};base64,${base64}`
  } catch {
    return null
  }
}

/**
 * Fetch all unique image URLs in a list of items and return a Map url → dataUri.
 * Items without an image_url are skipped.
 */
export async function prefetchItemImages(
  items: Array<{ image_url?: string | null }>,
): Promise<Map<string, string>> {
  const urls = [...new Set(items.map((i) => i.image_url).filter((u): u is string => !!u))]
  const results = await Promise.all(urls.map(async (url) => [url, await fetchImageAsDataUri(url)] as const))
  return new Map(results.filter(([, d]) => d !== null) as [string, string][])
}
