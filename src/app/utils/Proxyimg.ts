/**
 * Wrap external image URLs through /api/img proxy.
 * Required because COEP "require-corp" blocks cross-origin images directly.
 */
export function proxyImg(src: string | undefined | null): string {
  if (!src || src.startsWith('/') || src.startsWith('data:') || src.startsWith('blob:')) {
    return src ?? '';
  }
  return '/api/img?url=' + encodeURIComponent(src);
}