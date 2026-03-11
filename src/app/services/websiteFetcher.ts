/**
 * websiteFetcher.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Mengambil artikel dari sumber bertipe "website" (non-RSS).
 * Entry point: fetchFromWebsite(source, limit)
 *
 * Pipeline:
 *   1. Fetch HTML homepage sumber
 *   2. Cari semua link artikel di dalam halaman
 *   3. Untuk setiap link, cari thumbnail terdekat (img di container artikel)
 *   4. Fallback thumbnail ke og:image homepage jika tidak ada
 *   5. Gambar tidak pernah pakai splash/default — biarkan kosong jika tidak ditemukan
 *
 * Catatan desain:
 *   - Tidak ada rssContentSufficient — konten selalu perlu fetch penuh saat dibuka
 *   - Image placeholder = "" (kosong) → UI menampilkan ikon "no image"
 */

import type { Article } from "../data/articles";
import type { NewsSource } from "./sourceManager";
import {
  TRACKING_IMG_URL,
  hashId, guessCategory,
  fetchWithFallback,
} from "./fetcherUtils";

// ── Thumbnail hunter ──────────────────────────────────────────────────────────

/** Cari <img> yang ada di dalam container artikel terdekat dengan anchor */
function findNearbyImage(anchor: Element, baseUrl: string): string | null {
  const container =
    anchor.closest(
      "article, li, .card, .item, .post, .entry, " +
      "[class*='card'], [class*='item'], [class*='post'], [class*='article'], " +
      "[class*='news'], [class*='story']"
    ) ?? anchor.parentElement?.parentElement;

  if (!container) return null;

  const img = container.querySelector(
    "img[src], img[data-src], img[data-lazy-src], img[data-original]"
  );
  if (!img) return null;

  const src =
    img.getAttribute("data-lazy-src") ||
    img.getAttribute("data-src") ||
    img.getAttribute("data-original") ||
    img.getAttribute("src") || "";

  if (!src || src.startsWith("data:") || TRACKING_IMG_URL.test(src)) return null;

  try {
    const resolved = new URL(src, baseUrl).href;
    if (!resolved.startsWith("http")) return null;
    return resolved.replace(/^http:\/\//, "https://");
  } catch {
    return null;
  }
}

/** Ambil og:image atau twitter:image dari HTML mentah halaman */
function extractOgImage(html: string, baseUrl: string): string | null {
  const m =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']{10,})["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']{10,})["'][^>]+property=["']og:image["']/i) ??
    html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']{10,})["']/i);
  if (!m) return null;

  let u = m[1].trim();
  if (u.startsWith("//")) return "https:" + u;
  if (u.startsWith("/")) {
    try { return new URL(u, baseUrl).href; } catch { return null; }
  }
  if (u.startsWith("http://")) return u.replace("http://", "https://");
  return u.startsWith("https://") ? u : null;
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function fetchFromWebsite(source: NewsSource, limit = 15): Promise<Article[]> {
  const rawUrl = /^https?:\/\//i.test(source.url) ? source.url : "https://" + source.url;

  let html: string;
  try {
    html = await fetchWithFallback(rawUrl);
  } catch {
    return [];
  }

  const doc = new DOMParser().parseFromString(html, "text/html");
  const hostname = new URL(rawUrl).hostname;
  const seen = new Set<string>();

  // og:image sebagai fallback thumbnail jika tidak ada gambar di sekitar link
  // (tidak pakai sebagai default — biarkan kosong jika benar tidak ada gambar)
  const ogImage = extractOgImage(html, rawUrl);

  const links = Array.from(doc.querySelectorAll("a[href]"))
    .filter(a => {
      const href = (a as HTMLAnchorElement).href;
      const text = (a.textContent ?? "").trim();
      const ok =
        href.includes(hostname) &&
        !href.includes("#") &&
        !/\?(tag|cat|page|s)=/.test(href) &&
        !/\/(tag|category|page|author)\//i.test(href) &&
        text.length > 25;
      if (!ok || seen.has(href)) return false;
      seen.add(href);
      return true;
    })
    .slice(0, limit);

  return links.map((a, i) => {
    const title = (a.textContent ?? "").trim();
    const href = (a as HTMLAnchorElement).href;
    const cat = guessCategory(title);

    // Prioritas: gambar terdekat di DOM > og:image homepage > kosong (no-image)
    // TIDAK pakai fallback splash — lebih jujur ke user
    const nearbyImg = findNearbyImage(a, rawUrl);
    const image = nearbyImg ?? ogImage ?? "";

    return {
      id: hashId(href || title),
      category: cat,
      title,
      summary: title,
      content: [],
      source: source.name,
      sourceId: source.id,
      image,
      // Website tidak pernah sufficient — selalu fetch saat dibuka
      rssContentSufficient: false,
      readTime: 3,
      publishedAt: "Baru saja",
      hot: i < 2,
      originalUrl: href || undefined,
    } as Article;
  });
}