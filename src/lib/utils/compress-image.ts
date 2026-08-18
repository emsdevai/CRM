/**
 * compress-image.ts
 *
 * Browser-side image compression using `browser-image-compression`.
 * Converts the result to WebP for maximum size reduction.
 *
 * Target: any phone photo (4-5 MB) → ≤ 500 KB, max 1920 × 1920 px.
 * WebP at quality 80 keeps furniture detail sharp while cutting size ~70-80%.
 */

import imageCompression from 'browser-image-compression'

export interface CompressOptions {
  /** Maximum output file size in MB (default 0.45 → 450 KB) */
  maxSizeMB?: number
  /** Maximum edge length in pixels (default 1920) */
  maxWidthOrHeight?: number
  /** 0-1 quality passed to the WebP encoder (default 0.82) */
  initialQuality?: number
}

/**
 * Compress an image File.
 * Returns a new File in WebP format named `<original-stem>.webp`.
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {},
): Promise<File> {
  const {
    maxSizeMB = 0.45,          // 450 KB hard ceiling
    maxWidthOrHeight = 1920,   // plenty for product shots on any screen
    initialQuality = 0.82,
  } = options

  const compressed = await imageCompression(file, {
    maxSizeMB,
    maxWidthOrHeight,
    initialQuality,
    useWebWorker: true,        // keeps the UI responsive during compression
    fileType: 'image/webp',    // WebP is consistently 25-35% smaller than JPEG
    preserveExif: false,       // strip EXIF (GPS, camera model) — saves bytes, protects privacy
  })

  // Rename to .webp so the storage path extension matches the actual MIME type
  const stem = file.name.replace(/\.[^.]+$/, '')
  return new File([compressed], `${stem}.webp`, { type: 'image/webp' })
}
