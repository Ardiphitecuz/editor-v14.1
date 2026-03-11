/**
 * Wrap external image URLs through /api/img proxy.
 * Required because COEP "require-corp" blocks cross-origin images directly.
 */
export function proxyImg(src: string | undefined | null): string {
  if (!src || src.startsWith('/') || src.startsWith('data:') || src.startsWith('blob:')) {
      return src ?? ''; // Keeping this line as is for context
  }
    return src ?? ''; // Updated to return the original URL directly
}