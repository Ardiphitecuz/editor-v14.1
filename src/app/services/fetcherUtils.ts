/**
 * fetcherUtils.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared utilities: konstanta sanitizer, fungsi sanitizeHtml, proxy fetch,
 * dan helper kecil. Dipakai oleh rssFetcher.ts dan websiteFetcher.ts.
 */

import type { Article } from "../data/articles";

// ── Proxy endpoints ───────────────────────────────────────────────────────────
export const RSS2JSON         = "https://api.rss2json.com/v1/api.json?rss_url=";
export const SERVER_RSS_PROXY = "/api/rss?url=";
export const SERVER_PROXY     = "/api/proxy?url=";
export const PUBLIC_PROXIES   = [
  "https://corsproxy.io/?",
  "https://api.allorigins.win/raw?url=",
  "https://api.codetabs.com/v1/proxy?quest=",
];

// ── Allowlist — hanya tag tipografi yang diizinkan ────────────────────────────
export const ALLOWED_TAGS = new Set([
  "p", "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "blockquote", "pre", "code",
  "strong", "em", "b", "i", "br",
  "a", "img", "figure", "figcaption",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td",
]);

// Tag dibuang beserta seluruh isinya
export const REMOVE_WITH_CONTENT = new Set([
  "script", "style", "noscript", "iframe", "object", "embed",
  "form", "input", "button", "select", "textarea",
  "nav", "header", "footer", "aside", "menu", "svg", "canvas", "video", "audio",
]);

// Tracking pixel — URL mengandung kata kunci ini → gambar dibuang
export const TRACKING_IMG_URL =
  /feedburner|doubleclick|google-analytics|googletagmanager|pixel\.|analytics|share\.|adserver|pagead|adsystem|scorecardresearch|quantserve|omniture|chartbeat|\/ads\/|\/ad\//i;

// Noise teks editorial
export const NOISE_TEXT_EXACT =
  /^(advertisement|iklan|sponsored|promo|share(?: this)?|follow us|subscribe(?: now)?|sign up|comment[s]?|related|read more|selengkapnya|baca juga|lihat juga|artikel terkait|rekomendasi|back to top|load more|see more|click here|続きを読む|もっと見る)\.?$/i;

// ── Fallback images ───────────────────────────────────────────────────────────
export const FALLBACK_IMAGES: Record<string, string> = {
  "Hot Topic": "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&q=80",
  "Breaking":  "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&q=80",
  "Trending":  "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800&q=80",
  "Discuss":   "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80",
  "Review":    "https://images.unsplash.com/photo-1512314889357-e157c22f938d?w=800&q=80",
  "Analisis":  "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80",
  "default":   "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&q=80",
};
export const fallbackImg = (cat: string) =>
  FALLBACK_IMAGES[cat] ?? FALLBACK_IMAGES["default"];

// ── Helpers ───────────────────────────────────────────────────────────────────

export function hashId(s: string): string {
  if (!s) return Math.random().toString(36).slice(2);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  return Math.abs(h).toString(36);
}

export function decodeHtmlEntities(s: string): string {
  if (!s) return "";
  try {
    const t = document.createElement("textarea");
    t.innerHTML = s;
    return t.value;
  } catch {
    return s
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, " ")
      .replace(/&ndash;/g, "–").replace(/&mdash;/g, "—").replace(/&hellip;/g, "…")
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  }
}

export function relTime(d: string): string {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  const ms = Date.now() - date.getTime();
  const m = Math.floor(ms / 60000), h = Math.floor(m / 60), day = Math.floor(h / 24);
  if (m < 1) return "Baru saja";
  if (m < 60) return m + " menit lalu";
  if (h < 24) return h + " jam lalu";
  if (day < 7) return day + " hari lalu";
  // Untuk artikel lama: tampilkan tanggal dan jam persis sesuai sumber
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: day > 365 ? "numeric" : undefined })
    + " " + date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

// rawPubDate: simpan timestamp Unix (ms) untuk sorting — jangan dikonversi ke string dulu
export function rawPubTimestamp(d: string): number {
  if (!d) return 0;
  const t = new Date(d).getTime();
  return isNaN(t) ? 0 : t;
}

export function guessCategory(title: string, tags: string[] = []): string {
  const t = (title + " " + tags.join(" ")).toLowerCase();
  if (/速報|breaking|darurat|urgent/.test(t)) return "Breaking";
  if (/悲報|masalah|gagal|kontroversi|skandal/.test(t)) return "Discuss";
  if (/朗報|rilis|launch|sukses|resmi/.test(t)) return "Trending";
  if (/review|ulasan|resensi/.test(t)) return "Review";
  if (/opini|analisis|opinion/.test(t)) return "Analisis";
  return "Hot Topic";
}

// ── Proxy fetch ───────────────────────────────────────────────────────────────

export async function fetchWithFallback(url: string, ms = 12000): Promise<string> {
  // ① Server proxy
  try {
    const res = await fetch(SERVER_PROXY + encodeURIComponent(url), {
      signal: AbortSignal.timeout(30000), // timeout diperpanjang jadi 30 detik
    });
    if (res.ok) {
      const text = await res.text();
      if (text.length > 100) return text;
    }
  } catch { /* lanjut */ }

  // ② rss2json untuk Google News
  if (url.includes("news.google.com")) {
    try {
      const res = await fetch(`${RSS2JSON}${encodeURIComponent(url)}&count=20`, {
        signal: AbortSignal.timeout(ms),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.status === "ok" && json.items?.length) {
          const items = json.items
            .map((item: any) => `<item>
              <title><![CDATA[${item.title ?? ""}]]></title>
              <link>${item.link ?? ""}</link>
              <pubDate>${item.pubDate ?? ""}</pubDate>
              <description><![CDATA[${item.description ?? ""}]]></description>
              <source>${item.author ?? ""}</source>
            </item>`)
            .join("");
          return `<?xml version="1.0"?><rss version="2.0"><channel>
            <title>${json.feed?.title ?? "Google News"}</title>${items}
          </channel></rss>`;
        }
      }
    } catch { /* lanjut */ }
  }

  // ③ Public CORS proxies — last resort
  let last: Error = new Error("all proxies failed");
  for (const proxy of PUBLIC_PROXIES) {
    try {
      const res = await fetch(proxy + encodeURIComponent(url), {
        signal: AbortSignal.timeout(ms),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const text = await res.text();
      if (text.length > 100) return text;
    } catch (e) {
      last = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw last;
}

// ── Canonical HTML Sanitizer ──────────────────────────────────────────────────
/**
 * Prinsip (Readability Heuristics + Strict Allowlist):
 *   A. ALLOWLIST — hanya tag tipografi; tag lain di-unwrap (isinya dipertahankan)
 *   B. HAPUS semua class, id, style inline
 *   C. HAPUS tracking pixel (1×1, URL tracker, data URI)
 *   D. RESOLVE URL relatif → absolut; normalisasi http→https
 *   E. PERTAHANKAN gambar konten: deteksi via dimensi, posisi dalam <figure>,
 *      atau Readability heuristic (gambar tanpa dimensi eksplisit = konten)
 *   F. PERTAHANKAN srcset → resolve semua URL di dalamnya
 *   G. Tambahkan loading="lazy" + decoding="async" ke semua gambar
 */
export function sanitizeHtml(rawHtml: string, baseUrl: string): string {
  if (!rawHtml || rawHtml.trim().length < 3) return "";

  const html = rawHtml
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!\[CDATA\[/gi, "")
    .replace(/\]\]>/gi, "");
  const doc = document.implementation.createHTMLDocument("");
  doc.body.innerHTML = html;

  let origin = "";
  try { origin = new URL(baseUrl).origin; } catch {}

  function resolveUrl(src: string): string {
    if (!src) return "";
    src = src.trim();
    if (src.startsWith("data:")) return "";
    if (src.startsWith("https://")) return src;
    if (src.startsWith("http://")) return "https://" + src.slice(7);
    if (src.startsWith("//")) return "https:" + src;
    if (src.startsWith("/") && origin) return origin + src;
    try { return new URL(src, baseUrl).href; } catch { return src; }
  }

  // F. Resolve semua URL dalam atribut srcset
  function resolveSrcset(srcset: string): string {
    return srcset
      .split(",")
      .map(part => {
        const t = part.trim();
        const sp = t.search(/\s/);
        if (sp === -1) { const r = resolveUrl(t); return r || null; }
        const r = resolveUrl(t.slice(0, sp));
        return r ? r + t.slice(sp) : null;
      })
      .filter(Boolean)
      .join(", ");
  }

    // Custom rule: hapus semua <img> yang muncul setelah <p>
    function removeImagesAfterParagraph(doc: Document) {
      // Temukan semua <p> di dokumen
      const paragraphs = Array.from(doc.body.querySelectorAll('p'));
      if (paragraphs.length === 0) return;
      // Temukan semua <img> di dokumen
      const images = Array.from(doc.body.querySelectorAll('img'));
      images.forEach(img => {
        // Cek apakah ada <p> sebelum <img> (secara urutan DOM)
        let node = img.previousElementSibling;
        while (node) {
          if (node.tagName && node.tagName.toLowerCase() === 'p') {
            img.remove();
            break;
          }
          node = node.previousElementSibling;
        }
      });
    }
  /**
   * E. Readability heuristic: apakah gambar ini termasuk konten artikel?
   * Gambar dianggap KONTEN jika:
   *   1. Ada di dalam <figure> (editorial intent jelas)
   *   2. Lebar/tinggi eksplisit >= 200px (gambar besar = ilustrasi konten)
    // Hapus gambar setelah paragraf
    removeImagesAfterParagraph(doc);
   *   3. Tidak ada dimensi eksplisit (ukuran alami dari sumber)
   */
  function isContentImage(el: Element): boolean {
    const parent = el.parentElement;
    const grandp = parent?.parentElement;
    if (parent?.tagName.toLowerCase() === "figure") return true;
    if (grandp?.tagName.toLowerCase() === "figure") return true;
    const w = parseInt(el.getAttribute("width") ?? "0");
    const h = parseInt(el.getAttribute("height") ?? "0");
    if (w >= 200 || h >= 150) return true;
    if (w === 0 && h === 0) return true; // dimensi alami = kemungkinan konten
    return false;
  }

  function processNode(node: Node): void {
    if (node.nodeType === Node.COMMENT_NODE) { node.parentNode?.removeChild(node); return; }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    // A. Buang tag + seluruh isinya (elemen berbahaya)
    if (REMOVE_WITH_CONTENT.has(tag)) { el.remove(); return; }

    // A. Unwrap tag tidak di allowlist — PERTAHANKAN isinya
    if (!ALLOWED_TAGS.has(tag)) {
      const children = Array.from(el.childNodes);
      children.forEach(processNode);
      while (el.firstChild) el.parentNode?.insertBefore(el.firstChild, el);
      el.remove();
      return;
    }

    // B. Hapus atribut berbahaya
    ["class", "id", "style", "data-id", "onclick", "onload", "onerror"].forEach(a =>
      el.removeAttribute(a)
    );

    if (tag === "img") {
      // C. Prioritaskan lazy-load src (banyak CMS menyimpan URL asli di sini)
      const lazySrc =
        el.getAttribute("data-lazy-src") ||
        el.getAttribute("data-src") ||
        el.getAttribute("data-original") ||
        el.getAttribute("data-original-src") ||
        el.getAttribute("data-actualsrc") ||
        el.getAttribute("data-full-src");
      const rawSrc = el.getAttribute("src") || "";
      const bestSrc = lazySrc || (rawSrc.startsWith("data:") ? "" : rawSrc);

      // C. Buang tracking pixel / data URI
      if (!bestSrc || TRACKING_IMG_URL.test(bestSrc)) { el.remove(); return; }

      // C. Buang tracking pixel 1×1 atau 2×2
      const w = parseInt(el.getAttribute("width") ?? "0");
      const h = parseInt(el.getAttribute("height") ?? "0");
      if ((w > 0 && w <= 2) || (h > 0 && h <= 2)) { el.remove(); return; }

      // E. Readability heuristic — buang ikon/badge kecil berdasarkan URL pattern
      if (!isContentImage(el)) {
        if (/icon|logo|avatar|badge|button|spinner|loading|placeholder|spacer|1x1|pixel/i.test(bestSrc)) {
          el.remove();
          return;
        }
      }

      const resolved = resolveUrl(bestSrc);
      if (!resolved) { el.remove(); return; }

      // F. Proses srcset
      const rawSrcset = el.getAttribute("data-srcset") || el.getAttribute("srcset") || "";
      const cleanSrcset = rawSrcset ? resolveSrcset(rawSrcset) : "";

      // D + G. Set atribut bersih dengan lazy loading
      const altText = el.getAttribute("alt") ?? "";
      Array.from(el.attributes).forEach(a => el.removeAttribute(a.name));
      el.setAttribute("src", resolved);
      el.setAttribute("alt", altText);
      el.setAttribute("loading", "lazy");   // G. Tidak blokir render
      el.setAttribute("decoding", "async"); // G. Tidak blokir main thread
      if (cleanSrcset) el.setAttribute("srcset", cleanSrcset);
      return;
    }

    if (tag === "a") {
      const href = resolveUrl(el.getAttribute("href") ?? "");
      Array.from(el.attributes).forEach(a => el.removeAttribute(a.name));
      if (href && !href.startsWith("javascript:")) {
        el.setAttribute("href", href);
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener noreferrer");
      }
      Array.from(el.childNodes).forEach(processNode);
      return;
    }

    if (["p", "h1", "h2", "h3", "h4", "h5", "h6", "li"].includes(tag)) {
      const text = (el.textContent ?? "").trim();
      if (NOISE_TEXT_EXACT.test(text)) { el.remove(); return; }
    }

    Array.from(el.childNodes).forEach(processNode);
  }

  Array.from(doc.body.childNodes).forEach(processNode);

  // Post-pass: hapus elemen teks kosong (pertahankan jika ada gambar)
  doc.body.querySelectorAll("p, li, h1, h2, h3, h4, h5, h6").forEach(el => {
    if (!el.querySelector("img") && !(el.textContent ?? "").trim()) el.remove();
  });

  // Post-pass: hapus <figure> kosong
  doc.body.querySelectorAll("figure").forEach(el => {
    if (!el.querySelector("img") && !(el.textContent ?? "").trim()) el.remove();
  });

  // Post-pass: link density — hapus blok navigasi (hampir semua isinya link)
  doc.body.querySelectorAll("ul, ol, p").forEach(el => {
    if (el.querySelector("img")) return; // pertahankan jika ada gambar
    const total = (el.textContent ?? "").replace(/\s+/g, "").length;
    if (!total) { el.remove(); return; }
    let linkLen = 0;
    el.querySelectorAll("a").forEach(a => {
      linkLen += (a.textContent ?? "").replace(/\s+/g, "").length;
    });
    const threshold = el.tagName === "P" ? 0.9 : 0.75;
    if (linkLen / total >= threshold) el.remove();
  });

  // Post-pass: wrap orphan text nodes
  Array.from(doc.body.childNodes).forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? "").trim();
      if (text.length > 10) {
        const p = doc.createElement("p");
        p.textContent = text;
        node.parentNode?.insertBefore(p, node);
        node.parentNode?.removeChild(node);
      } else if (!text) {
        node.parentNode?.removeChild(node);
      }
    }
  });

  return doc.body.innerHTML.trim();
}

/**
 * proxyImgInHtml — ganti semua src/srcset gambar dalam HTML string dengan
 * URL proxy (/api/img?url=...) agar COEP tidak memblokir gambar cross-origin.
 * Dipanggil di ArticlePage sebelum dangerouslySetInnerHTML.
 *
 * PENTING: regex sebelumnya `(<img[^>]+\s)src=` TIDAK match `<img src=`
 * (satu spasi antara "img" dan "src") karena [^>]+ butuh ≥1 karakter lalu \s lagi.
 * Fix: gunakan lookahead/lookbehind sederhana — replace semua src= dalam <img> tag.
 */
export function proxyImgInHtml(html: string): string {
  if (!html) return html;

  return html.replace(/<img([^>]*)>/gi, (_fullTag: string, attrs: string) => {
    // Proxy src (dengan leading whitespace)
    let newAttrs = attrs.replace(
      /(\s)src="(https?:\/\/[^"]+)"/gi,
      (_m: string, space: string, url: string) =>
        `${space}src="/api/img?url=${encodeURIComponent(url)}"`
    );
    // Proxy src tanpa leading whitespace (kasus pertama di attrs)
    newAttrs = newAttrs.replace(
      /^src="(https?:\/\/[^"]+)"/i,
      (_m: string, url: string) =>
        `src="/api/img?url=${encodeURIComponent(url)}"`
    );
    // Proxy srcset
    newAttrs = newAttrs.replace(
      /(\s)srcset="([^"]+)"/gi,
      (_m: string, space: string, srcset: string) => {
        const proxied = srcset.replace(
          /(https?:\/\/[^\s,]+)/gi,
          (u: string) => `/api/img?url=${encodeURIComponent(u)}`
        );
        return `${space}srcset="${proxied}"`;
      }
    );
    return `<img${newAttrs}>`;
  });
}

// ── Content scoring ───────────────────────────────────────────────────────────

export function scoreContent(html: string): number {
  if (!html) return 0;
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const cjk = (text.match(/[\u3000-\u9fff\uf900-\ufaff\u3400-\u4dbf]/g) ?? []).length;
  const textScore = text.length + cjk;
  const imgCount = (html.match(/<img[^>]+src=/gi) ?? []).length;
  const imgBonus = textScore >= 50 ? imgCount * 120 : 0;
  return textScore + imgBonus;
}

// Artikel dianggap "cukup" jika skor >= threshold ini.
// 800 = minimal ~3 paragraf pendek + 1 gambar, atau ~5 paragraf tanpa gambar.
// Threshold rendah (280) menyebabkan terlalu banyak artikel RSS ditandai sufficient
// padahal isinya hanya summary/teaser.
export const SUFFICIENT_THRESHOLD = 800;

export function extractPlainParagraphs(html: string): string[] {
  if (!html) return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  return Array.from(doc.querySelectorAll("p, li, blockquote"))
    .map(el => (el.textContent ?? "").replace(/\s+/g, " ").trim())
    .filter(t => t.length > 15)
    .slice(0, 20);
}

export function extractFirstImageUrl(html: string): string | null {
  if (!html) return null;

  const upgrade = (u: string) => {
    if (!u) return u;
    // Decode &amp; yang sering muncul di URL dalam RSS CDATA
    u = u.replace(/&amp;/gi, "&");
    return u.startsWith("http://") ? u.replace("http://", "https://") : u;
  };

  const isReal = (u: string) => {
    if (!u || u.startsWith("data:")) return false;
    if (TRACKING_IMG_URL.test(u)) return false;
    if (/[/?](1x1|pixel|tracking|stat|beacon|count)\./i.test(u)) return false;
    if (/\.(gif|svg)(\?|$)/i.test(u) && /placeholder|spinner|loading/i.test(u)) return false;
    return true;
  };

  // Cek media:thumbnail / media:content dulu (paling reliable di RSS)
  const mediaThumbnail =
    html.match(/media:thumbnail[^>]+url=["']([^"']{10,})["']/i) ||
    html.match(/media:content[^>]+url=["']([^"']{10,})["']/i);
  if (mediaThumbnail) {
    const u = upgrade(mediaThumbnail[1]);
    if (isReal(u)) return u;
  }

  // Cek enclosure
  const enclosure =
    html.match(/enclosure[^>]+url=["']([^"']{10,})["'][^>]*type=["']image/i) ||
    html.match(/enclosure[^>]+type=["']image[^"']*["'][^>]+url=["']([^"']{10,})["']/i);
  if (enclosure) {
    const u = upgrade(enclosure[1]);
    if (isReal(u)) return u;
  }

  // Scan semua <img> — prioritaskan lazy-load attributes
  const imgRe = /<img([^>]+)>/gi;
  let m;
  while ((m = imgRe.exec(html)) !== null) {
    const attrs = m[1];
    const srcMatch =
      attrs.match(/\bdata-lazy-src=["']([^"']{10,})["']/i) ||
      attrs.match(/\bdata-src=["']([^"']{10,})["']/i) ||
      attrs.match(/\bdata-original=["']([^"']{10,})["']/i) ||
      attrs.match(/\bsrc=["']([^"']{10,})["']/i);
    if (!srcMatch) continue;
    const candidate = upgrade(srcMatch[1]);
    if (!isReal(candidate)) continue;
    if (/data:image|placeholder|spinner|loading/i.test(candidate)) continue;
    return candidate;
  }
  return null;
}

// ── Article content fetch (server → browser fallback) ────────────────────────

export async function fetchArticleContent(
  url: string
): Promise<{ content: string[]; image?: string; summary?: string; contentHtml?: string } | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null;

  // ① Server-side Readability (paling akurat)
  try {
    const res = await fetch("/api/fetch-content?url=" + encodeURIComponent(url), {
      signal: AbortSignal.timeout(28000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.items?.[0]?.contentHtml) {
        return {
          content: [],
          image: data.items[0].image ?? undefined,
          summary: data.items[0].summary ?? undefined,
          contentHtml: data.items[0].contentHtml,
        };
      }
    }
  } catch { /* timeout → browser fallback */ }

  // ② Browser DOMParser fallback — Readability heuristic
  try {
    const html = await fetchWithFallback(url, 12000);
    const doc = new DOMParser().parseFromString(html, "text/html");

    // Buang elemen noise
    doc.querySelectorAll(
      "script,style,noscript,iframe,nav,header,footer,aside,form,menu,svg,canvas," +
      "[role='navigation'],[role='banner'],[role='complementary'],[role='contentinfo']," +
      ".nav,.navigation,.menu,.sidebar,.footer,.header,.advertisement,.promo,.related," +
      "[class*='share'],[class*='social'],[class*='comment'],[class*='recommend']"
    ).forEach(el => el.remove());

    /**
     * Readability scoring — sama seperti algoritma Mozilla Readability:
     * Hitung teks paragraf + bonus gambar konten.
     * Prioritaskan elemen semantik: article > main > [itemprop] > div/section
     */
    function scoreElement(el: Element): number {
      let score = 0;
      // Bonus semantik: elemen yang memang untuk konten artikel
      const tag = el.tagName.toLowerCase();
      if (tag === "article") score += 300;
      else if (tag === "main") score += 200;
      else if (el.getAttribute("role") === "main") score += 200;
      else if (el.getAttribute("itemprop") === "articleBody") score += 250;

      // Cek class/id yang mengindikasikan konten
      const classId = ((el.getAttribute("class") ?? "") + " " + (el.getAttribute("id") ?? "")).toLowerCase();
      if (/\b(article|content|post|entry|story|body|text|main)\b/.test(classId)) score += 100;
      if (/\b(comment|sidebar|widget|ad|promo|related|nav|menu|footer|header)\b/.test(classId)) score -= 200;

      // Skor teks dari paragraf
      el.querySelectorAll("p, li, blockquote, h2, h3, h4").forEach(child => {
        const text = (child.textContent ?? "").trim();
        if (text.length < 20) return;
        const cjk = (text.match(/[\u3000-\u9fff]/g) ?? []).length;
        score += text.length + cjk * 2;
      });

      // Bonus gambar konten (gambar yang bukan ikon/tracking)
      el.querySelectorAll("img").forEach(img => {
        const src = img.getAttribute("src") || img.getAttribute("data-src") || "";
        if (!src || src.startsWith("data:") || TRACKING_IMG_URL.test(src)) return;
        const w = parseInt(img.getAttribute("width") ?? "0");
        const h = parseInt(img.getAttribute("height") ?? "0");
        if ((w > 0 && w <= 2) || (h > 0 && h <= 2)) return; // tracking pixel
        // Gambar besar atau tanpa dimensi = konten artikel
        if (w === 0 || w >= 200 || h >= 150) score += 180;
      });

      // Penalti jika terlalu banyak link (halaman daftar/navigasi)
      const totalText = (el.textContent ?? "").replace(/\s+/g, "").length;
      if (totalText > 0) {
        let linkLen = 0;
        el.querySelectorAll("a").forEach(a => {
          linkLen += (a.textContent ?? "").replace(/\s+/g, "").length;
        });
        if (linkLen / totalText > 0.5) score -= 150;
      }

      return score;
    }

    // Kandidat: prioritaskan elemen semantik dulu, lalu div/section
    const semanticCandidates = Array.from(
      doc.querySelectorAll("article, main, [role='main'], [itemprop='articleBody']")
    );
    const genericCandidates = Array.from(
      doc.querySelectorAll("div, section")
    ).filter(el => {
      // Hanya div/section yang tidak terlalu dalam atau terlalu dangkal
      if (el === doc.body) return false;
      if (el.querySelectorAll("article, main").length > 0) return false;
      return true;
    });

    const allCandidates = [...semanticCandidates, ...genericCandidates];

    let bestEl: Element = doc.body;
    let bestScore = 0;

    for (const el of allCandidates) {
      const score = scoreElement(el);
      if (score > bestScore) {
        bestScore = score;
        bestEl = el;
      }
    }

    const contentHtml = sanitizeHtml(bestEl.innerHTML, url);
    const content = extractPlainParagraphs(contentHtml);
    return { content, contentHtml: contentHtml || undefined, summary: content[0] };
  } catch { return null; }
}