/**
 * Client-Side Image Compression Utility
 * Resizes and compresses images using HTML5 Canvas before uploading to Supabase Storage.
 * Reduces payload size by 60-80% without noticeable visual degradation.
 */

export interface CompressionOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  mimeType?: 'image/jpeg' | 'image/webp' | 'image/png'
}

export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.82,
    mimeType = 'image/jpeg',
  } = options

  // Don't attempt compression on GIFs (preserve animation) or SVGs
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return file
  }

  // If already under 150KB, skip heavy compression
  if (file.size < 150 * 1024) {
    return file
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onerror = () => reject(new Error('Failed to read image file'))

    reader.onload = () => {
      const img = new Image()

      img.onerror = () => reject(new Error('Failed to load image element'))

      img.onload = () => {
        let width = img.width
        let height = img.height

        // Calculate aspect-ratio preserving dimensions
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          // If canvas 2d context unavailable, fallback to original
          resolve(file)
          return
        }

        // High quality image smoothing
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file)
              return
            }

            // Only use compressed if it actually reduced file size
            if (blob.size < file.size) {
              const extension = mimeType === 'image/jpeg' ? '.jpg' : mimeType === 'image/webp' ? '.webp' : '.png'
              const originalBase = file.name.replace(/\.[^/.]+$/, '')
              const compressedFile = new File([blob], `${originalBase}${extension}`, {
                type: mimeType,
                lastModified: Date.now(),
              })
              resolve(compressedFile)
            } else {
              resolve(file)
            }
          },
          mimeType,
          quality
        )
      }

      img.src = reader.result as string
    }

    reader.readAsDataURL(file)
  })
}

/**
 * Compress an array of files in parallel
 */
export async function compressImages(
  files: File[],
  options?: CompressionOptions
): Promise<File[]> {
  return Promise.all(files.map((f) => compressImage(f, options)))
}
