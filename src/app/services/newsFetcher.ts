import type { Article } from "../data/articles";
import type { NewsSource } from "./sourceManager";
import { updateSourceMeta } from "./sourceManager";

const RSS2JSON = "https://api.rss2json.com/v1/api.json?rss_url=";
const SERVER_RSS_PROXY  = "/api/rss?url=";    // untuk RSS/XML feed
const SERVER_PROXY     = "/api/proxy?url=";  // untuk halaman artikel (HTML biasa)
const PUBLIC_PROXIES = [
  "https://corsproxy.io/?",
  "https://api.allorigins.win/raw?url=",
  "https://api.codetabs.com/v1/proxy?quest=",
];

// ─────────────────────────────────────────────────────────────────────────────
// § 1. UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/** ID stabil dari URL artikel — deterministik, tidak pernah undefined */
function hashId(s: string): string {
  if (!s) return Math.random().toString(36).slice(2);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  return Math.abs(h).toString(36);
}

/** Decode semua HTML entities termasuk numeric */
function decodeHtmlEntities(s: string): string {
  if (!s) return "";
  // Gunakan textarea trick — browser melakukan decode 100% akurat
  try {
    const t = document.createElement("textarea");
    t.innerHTML = s;
    return t.value;
  } catch {
    // Fallback manual untuk environment tanpa DOM
    return s
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, " ")
      .replace(/&ndash;/g, "–").replace(/&mdash;/g, "—").replace(/&hellip;/g, "…")
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  }
}

function relTime(d: string): string {
  const ms = Date.now() - new Date(d).getTime();
  if (!ms || isNaN(ms)) return "Baru saja";
  const m = Math.floor(ms / 60000), h = Math.floor(m / 60), day = Math.floor(h / 24);
  if (m < 2) return "Baru saja";
  if (m < 60) return m + " menit lalu";
  if (h < 24) return h + " jam lalu";
  if (day < 7) return day + " hari lalu";
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

const FALLBACK_IMAGES: Record<string, string> = {
  "Hot Topic": "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&q=80",
  "Breaking":  "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&q=80",
  "Trending":  "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800&q=80",
  "Discuss":   "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80",
  "Review":    "https://images.unsplash.com/photo-1512314889357-e157c22f938d?w=800&q=80",
  "Analisis":  "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80",
  "default":   "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&q=80",
};
const fallbackImg = (cat: string) => FALLBACK_IMAGES[cat] ?? FALLBACK_IMAGES["default"];

function guessCategory(title: string, tags: string[] = []): string {
  const t = (title + " " + tags.join(" ")).toLowerCase();
  if (/速報|breaking|darurat|urgent/.test(t)) return "Breaking";
  if (/悲報|masalah|gagal|kontroversi|skandal/.test(t)) return "Discuss";
  if (/朗報|rilis|launch|sukses|resmi/.test(t)) return "Trending";
  if (/review|ulasan|resensi/.test(t)) return "Review";
  if (/opini|analisis|opinion/.test(t)) return "Analisis";
  return "Hot Topic";
}

// ─────────────────────────────────────────────────────────────────────────────
// § 2. INOREADER-STYLE HTML SANITIZER
//
// Prinsip kunci (mengikuti Inoreader & Feedly):
//   A. ALLOWLIST — hanya tag tipografi yang diizinkan, sisanya dibuang
//   B. STRIP semua atribut class/id/style — iklan selalu bersembunyi di sini
//   C. HAPUS tracking pixel & iklan berdasarkan ciri URL, bukan nama class
//   D. RESOLVE URL relatif → absolut
//   E. Simpan sebagai string HTML bersih — BUKAN array of blocks
// ─────────────────────────────────────────────────────────────────────────────

// Tag yang DIIZINKAN — hanya tipografi & media konten editorial
const ALLOWED_TAGS = new Set([
  "p", "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "blockquote", "pre", "code",
  "strong", "em", "b", "i", "s", "u", "mark", "sub", "sup",
  "a", "br", "hr",
  "img", "figure", "figcaption",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td",
]);

// Tag yang langsung dibuang beserta seluruh isinya
const REMOVE_WITH_CONTENT = new Set([
  "script", "style", "noscript", "iframe", "object", "embed",
  "form", "input", "button", "select", "textarea",
  "nav", "header", "footer", "aside", "menu",
  "svg", "canvas", "video", "audio",
]);

// Pola URL gambar yang merupakan tracking pixel / iklan / noise
const TRACKING_IMG_URL = /feedburner\.com|doubleclick\.net|google-analytics|googletagmanager|\/pixel\.gif|\/pixel\.png|1x1\.|2x1\.|adserver|pagead|banner_ad|adsystem|scorecardresearch|quantserve|omniture|chartbeat|newrelic|\/ads\/|\/ad\//i;

// Pola teks yang merupakan noise editorial (label, tombol, CTA)
const NOISE_TEXT_EXACT = /^(advertisement|iklan|sponsored|promo|share(?: this)?|follow us|subscribe(?: now)?|sign up|comment[s]?|related|read more|selengkapnya|baca juga|lihat juga|artikel terkait|rekomendasi|back to top|load more|see more|click here|more\.{3}|続きを読む|もっと見る)\.?$/i;

export function sanitizeRssHtml(rawHtml: string, baseUrl: string): string {
  if (!rawHtml || rawHtml.trim().length < 3) return "";

  // Strip CDATA wrapper jika ada
  const html = rawHtml
    .replace(/<!\[CDATA\[/gi, "")
    .replace(/\]\]>/gi, "");

  // Parse ke DOM
  const doc = document.implementation.createHTMLDocument("");
  doc.body.innerHTML = html;

  // Resolve URL relatif → absolut
  let origin = "";
  try { origin = new URL(baseUrl).origin; } catch { /* ignored */ }

  function resolveUrl(src: string): string {
    if (!src) return "";
    src = src.trim();
    if (src.startsWith("data:")) return ""; // buang data URI
    if (src.startsWith("//")) return "https:" + src;
    if (src.startsWith("http://")) return src.replace("http://", "https://"); // upgrade HTTP→HTTPS
    if (src.startsWith("https://")) return src;
    if (src.startsWith("/") && origin) return origin + src;
    try { return new URL(src, baseUrl).href; } catch { return src; }
  }

  // Rekursif: bersihkan setiap node
  function processNode(node: Node): void {
    if (node.nodeType === Node.COMMENT_NODE) {
      node.parentNode?.removeChild(node);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    // ── Buang tag beserta isinya ──────────────────────────────────────────────
    if (REMOVE_WITH_CONTENT.has(tag)) {
      el.remove();
      return;
    }

    // ── Tag tidak dalam allowlist → "unwrap": angkat children ke parent ───────
    if (!ALLOWED_TAGS.has(tag)) {
      // Rekursif child dulu, baru unwrap
      Array.from(el.childNodes).forEach(processNode);
      while (el.firstChild) el.parentNode?.insertBefore(el.firstChild, el);
      el.remove();
      return;
    }

    // ── ALLOWLIST: proses tag yang diizinkan ──────────────────────────────────

    // RULE B: Hapus SEMUA atribut class, id, style — selalu!
    el.removeAttribute("class");
    el.removeAttribute("id");
    el.removeAttribute("style");
    el.removeAttribute("data-id");
    el.removeAttribute("data-src");  // akan diganti dengan src jika dibutuhkan

    // RULE C & D: Gambar
    if (tag === "img") {
      const src =
        el.getAttribute("src") ||
        el.getAttribute("data-lazy-src") ||
        el.getAttribute("data-original") ||
        el.getAttribute("data-src") || "";

      // Buang tracking pixel berdasarkan URL
      if (!src || src.startsWith("data:") || TRACKING_IMG_URL.test(src)) {
        el.remove();
        return;
      }

      // Buang gambar 1×1 / 2×1 berdasarkan atribut width/height
      const w = parseInt(el.getAttribute("width") ?? "0");
      const h = parseInt(el.getAttribute("height") ?? "0");
      if ((w > 0 && w <= 2) || (h > 0 && h <= 2)) {
        el.remove();
        return;
      }

      const resolved = resolveUrl(src);
      if (!resolved) { el.remove(); return; }

      // Set atribut bersih
      el.setAttribute("src", resolved);
      el.setAttribute("loading", "lazy");
      el.setAttribute("alt", el.getAttribute("alt") ?? "");
      // Hapus atribut lain
      Array.from(el.attributes)
        .filter(a => !["src", "loading", "alt"].includes(a.name))
        .forEach(a => el.removeAttribute(a.name));
      return; // img tidak punya children
    }

    // RULE D: Link — hanya pertahankan href
    if (tag === "a") {
      const href = resolveUrl(el.getAttribute("href") ?? "");
      Array.from(el.attributes).forEach(a => el.removeAttribute(a.name));
      if (href) {
        el.setAttribute("href", href);
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener noreferrer");
      }
      Array.from(el.childNodes).forEach(processNode);
      return;
    }

    // Paragraf / heading: buang jika isinya noise
    if (["p", "h1", "h2", "h3", "h4", "h5", "h6", "li"].includes(tag)) {
      const text = (el.textContent ?? "").trim();
      if (NOISE_TEXT_EXACT.test(text)) { el.remove(); return; }
    }

    // Rekursif semua children
    Array.from(el.childNodes).forEach(processNode);
  }

  Array.from(doc.body.childNodes).forEach(processNode);

  // Post-pass 1: hapus elemen kosong yang tidak berguna
  doc.body.querySelectorAll("p, li, h1, h2, h3, h4, h5, h6").forEach(el => {
    const hasImg = el.querySelector("img");
    if (!hasImg && !(el.textContent ?? "").trim()) el.remove();
  });

  // Post-pass 1b: hapus navigasi / link sampah berdasarkan link density
  doc.body.querySelectorAll("ul, ol, p, div").forEach(el => {
    const totalText = (el.textContent ?? "").replace(/\s+/g, "").length;
    if (totalText === 0) { el.remove(); return; }
    let linkText = 0;
    el.querySelectorAll("a").forEach(a => {
      linkText += (a.textContent ?? "").replace(/\s+/g, "").length;
    });
    const density = totalText > 0 ? linkText / totalText : 0;
    const hasImages = el.querySelector("img") !== null;
    // ul/ol: hapus jika >75% link; p/div: lebih ketat >90%
    const threshold = (el.tagName === "P" || el.tagName === "DIV") ? 0.9 : 0.75;
    if (density >= threshold && !hasImages) el.remove();
  });

  // Post-pass 1c: hapus <p> yang isinya hanya satu link ("Baca juga: X", "Sumber: X")
  doc.body.querySelectorAll("p").forEach(p => {
    const anchors = Array.from(p.querySelectorAll("a"));
    if (anchors.length >= 1) {
      let linkTotal = 0;
      anchors.forEach(a => { linkTotal += (a.textContent ?? "").trim().length; });
      const outside = (p.textContent ?? "").trim().length - linkTotal;
      if (outside <= 15) p.remove(); // hanya "Baca juga: " di luar link
    }
  });

  // Post-pass 2: wrap orphan text nodes (hasil unwrap div) ke dalam <p>
  // Yaraon dan beberapa feed Jepang menempatkan teks langsung di dalam <div>
  // tanpa <p> wrapper — setelah unwrap, teks menjadi orphan text nodes di body
  Array.from(doc.body.childNodes).forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? "").trim();
      if (text.length > 10) {
        const p = doc.createElement("p");
        p.textContent = text;
        node.parentNode?.insertBefore(p, node);
        node.parentNode?.removeChild(node);
      } else if (text.length === 0) {
        node.parentNode?.removeChild(node);
      }
    }
  });

  return doc.body.innerHTML.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// § 3. CONTENT SCORING
// Menentukan apakah konten RSS cukup substantif atau perlu fetch halaman penuh
// ─────────────────────────────────────────────────────────────────────────────

function scoreContent(html: string): number {
  if (!html) return 0;
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  // CJK (Jepang/China/Korea) lebih informatif per karakter → bobot ×2
  const cjk = (text.match(/[\u3000-\u9fff\uf900-\ufaff\u3400-\u4dbf]/g) ?? []).length;
  const textScore = text.length + cjk;
  const imgCount = (html.match(/<img[^>]+src=/gi) ?? []).length;
  // Gambar hanya berkontribusi jika ada teks minimal (≥50 karakter)
  // Mencegah post gambar-only dari Yaraon dianggap "cukup" padahal tidak ada teks
  const imgBonus = textScore >= 50 ? imgCount * 120 : 0;
  return textScore + imgBonus;
}

// Konten "cukup" jika skor ≥ 280 (≈140 karakter latin atau ≈70 CJK + gambar)
const SUFFICIENT_THRESHOLD = 280;

function extractPlainParagraphs(html: string): string[] {
  if (!html) return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  return Array.from(doc.querySelectorAll("p, li, blockquote"))
    .map(el => (el.textContent ?? "").replace(/\s+/g, " ").trim())
    .filter(t => t.length > 15)
    .slice(0, 20);
}

function extractFirstImageUrl(html: string): string | null {
  if (!html) return null;

  function upgradeUrl(u: string): string {
    if (!u) return u;
    return u.startsWith("http://") ? u.replace("http://", "https://") : u;
  }
  function isRealImage(u: string): boolean {
    if (!u || u.startsWith("data:")) return false;
    if (TRACKING_IMG_URL.test(u)) return false;
    // Buang 1x1 pixel / tracking pixel berdasarkan dimensi di URL
    if (/[/?](1x1|pixel|tracking|stat|beacon|count)\./i.test(u)) return false;
    return true;
  }

  // 1. media:thumbnail / media:content (WordPress, Feedburner — paling akurat)
  const mediaThumbnail = html.match(/media:thumbnail[^>]+url=["']([^"']{10,})["']/i)
    || html.match(/media:content[^>]+url=["']([^"']{10,})["']/i);
  if (mediaThumbnail) {
    const u = upgradeUrl(mediaThumbnail[1]);
    if (isRealImage(u)) return u;
  }

  // 2. enclosure image
  const enclosure = html.match(/enclosure[^>]+url=["']([^"']{10,})["'][^>]*type=["']image/i)
    || html.match(/enclosure[^>]+type=["']image[^"']*["'][^>]+url=["']([^"']{10,})["']/i);
  if (enclosure) {
    const u = upgradeUrl(enclosure[1]);
    if (isRealImage(u)) return u;
  }

  // 3. Cari semua <img> — cek src, data-src, data-lazy-src, data-original
  // WordPress lazy load sering menaruh real URL di data-src bukan src
  const imgRe = /<img([^>]+)>/gi;
  let m;
  while ((m = imgRe.exec(html)) !== null) {
    const attrs = m[1];
    // Cek semua atribut sumber gambar dalam urutan prioritas
    const srcMatch =
      attrs.match(/data-lazy-src=["']([^"']{10,})["']/i) ||
      attrs.match(/data-src=["']([^"']{10,})["']/i) ||
      attrs.match(/data-original=["']([^"']{10,})["']/i) ||
      attrs.match(/src=["']([^"']{10,})["']/i);
    if (!srcMatch) continue;
    const candidate = upgradeUrl(srcMatch[1]);
    if (!isRealImage(candidate)) continue;
    // Skip placeholder GIF/SVG (lazy load placeholder)
    if (/\.(gif|svg)(\?|$)/i.test(candidate) && candidate.includes('placeholder')) continue;
    if (/data:image|placeholder|spinner|loading/i.test(candidate)) continue;
    return candidate;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// § 4. PROXY FETCH
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchWithFallback(url: string, ms = 12000): Promise<string> {
  // ① Server proxy (paling handal) — gunakan /api/proxy untuk halaman HTML
  try {
    const res = await fetch(SERVER_PROXY + encodeURIComponent(url), {
      signal: AbortSignal.timeout(ms),
    });
    if (res.ok) {
      const text = await res.text();
      if (text.length > 100) return text;
    }
  } catch { /* lanjut */ }

  // ② rss2json untuk Google News (resolve redirect)
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

  // ③ Public CORS proxies sebagai last resort
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

// ─────────────────────────────────────────────────────────────────────────────
// § 5. FULL ARTICLE FETCHER (untuk saat RSS tidak cukup)
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchArticleContent(
  url: string
): Promise<{ content: string[]; image?: string; summary?: string; contentHtml?: string } | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null;

  // ① Server-side Readability (hasil terbaik)
  // fetch-content.js sudah punya fallback ke public proxy jika site blokir Vercel,
  // jadi kita beri timeout lebih panjang dan jangan terlalu cepat menyerah
  try {
    const res = await fetch("/api/fetch-content?url=" + encodeURIComponent(url), {
      signal: AbortSignal.timeout(28000), // naik dari 15s → 28s (beri waktu proxy)
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
  } catch { /* timeout atau network error → browser fallback */ }

  // ② Browser DOMParser fallback — HANYA jika server benar-benar tidak bisa dicapai
  // (bukan karena site blokir, karena itu sudah ditangani di server via proxy)
  try {
    const html = await fetchWithFallback(url, 12000);
    const doc = new DOMParser().parseFromString(html, "text/html");

    // Hapus noise struktural — lebih agresif dari sebelumnya
    doc.querySelectorAll(
      "script,style,noscript,iframe,nav,header,footer,aside,form,menu," +
      "[class*='sidebar'],[class*='related'],[class*='recommend']," +
      "[class*='widget'],[class*='comment'],[class*='share'],[class*='social']," +
      "[class*='newsletter'],[class*='subscribe'],[class*='popup'],[class*='banner']," +
      "[class*='ad-'],[class*='-ad'],[id*='sidebar'],[id*='related'],[id*='ad-']," +
      "[class*='entry-meta'],[class*='post-meta'],[class*='post-author']," +
      "[class*='cat-links'],[class*='post-category'],[class*='sharedaddy']," +
      "[class*='navigation'],[class*='pagination'],[class*='breadcrumb']"
    ).forEach(el => el.remove());

    // Scoring: cari elemen dengan konten terbanyak (hitung p, li, blockquote)
    let bestEl: Element = doc.body;
    let bestScore = 0;
    doc.querySelectorAll("article, main, [role='main'], div, section").forEach(el => {
      // Skip wrapper yang terlalu besar (> 80% halaman = bukan konten spesifik)
      if (el === doc.body || el.querySelectorAll("article, main").length > 2) return;
      let score = 0;
      el.querySelectorAll("p, li, blockquote").forEach(child => {
        const text = (child.textContent ?? "").trim();
        if (text.length < 20) return;
        // CJK chars dihitung 2x — lebih informatif per karakter
        const cjk = (text.match(/[\u3000-\u9fff]/g) ?? []).length;
        score += text.length + cjk;
      });
      if (score > bestScore) { bestScore = score; bestEl = el; }
    });

    const contentHtml = sanitizeRssHtml(bestEl.innerHTML, url);
    const content = extractPlainParagraphs(contentHtml);
    return {
      content,
      contentHtml: contentHtml || undefined,
      summary: content[0],
    };
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// § 6. RSS ITEM → ARTICLE
// Strategi Inoreader:
//   1. Sanitasi konten RSS → contentHtml (selalu)
//   2. Score konten: jika cukup → tampilkan langsung (rssContentSufficient=true)
//   3. Jika tidak cukup → ArticlePage fetch full artikel di background
//      tapi contentHtml dari RSS sudah tersedia sebagai "preview sementara"
// ─────────────────────────────────────────────────────────────────────────────

function buildFromRssContent(
  rawHtml: string,
  baseUrl: string,
  forceSufficient?: boolean,
  fallbackTitle?: string
): {
  contentHtml: string;
  content: string[];
  heroImage: string | null;
  sufficient: boolean;
} {
  // PENTING: Jangan pakai decodeHtmlEntities di sini!
  // sanitizeRssHtml menggunakan doc.body.innerHTML yang sudah menangani entity decode
  // secara otomatis. Kalau pakai textarea.value dulu, SEMUA HTML tag akan di-strip
  // sebelum sanitasi → gambar dan format hilang.
  const stripped = (rawHtml ?? "")
    .replace(/<!\[CDATA\[/gi, "")
    .replace(/\]\]>/gi, "");

  // extractFirstImageUrl dari HTML mentah (sebelum sanitasi membuang beberapa gambar)
  const heroImage = extractFirstImageUrl(stripped);

  const cleanHtml = sanitizeRssHtml(stripped, baseUrl);

  // Jika setelah sanitasi kosong, gunakan fallback title
  const finalHtml = cleanHtml || (fallbackTitle ? `<p>${fallbackTitle}</p>` : "");

  const content = extractPlainParagraphs(finalHtml);

  const score = scoreContent(finalHtml);
  const sufficient = forceSufficient ?? (score >= SUFFICIENT_THRESHOLD);

  return { contentHtml: finalHtml, content, heroImage, sufficient };
}

// ─────────────────────────────────────────────────────────────────────────────
// § 7. FEED PARSERS
// ─────────────────────────────────────────────────────────────────────────────

async function fetchRss2Json(feedUrl: string): Promise<any> {
  try {
    const res = await fetch(`${RSS2JSON}${encodeURIComponent(feedUrl)}&count=20`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.status === "ok" && data.items?.length ? data : null;
  } catch { return null; }
}

function articlesFromR2J(source: NewsSource, data: any, limit: number): Article[] {
  return data.items.slice(0, limit).map((item: any, i: number) => {
    const title = decodeHtmlEntities(item.title ?? "Untitled");
    const cat = guessCategory(title, item.categories ?? []);
    const baseUrl = item.link || source.url;

    // rss2json menggabungkan content + description — gunakan yang terpanjang
    const rawContent =
      (item.content?.length ?? 0) > (item.description?.length ?? 0)
        ? item.content
        : item.description || item.content || "";

    const isYaraon = source.rssContentSufficient === true;
    const parsed = buildFromRssContent(rawContent, baseUrl, isYaraon || undefined, title);

    // Pilih thumbnail terbaik: rss2json thumbnail > enclosures > gambar konten > fallback
    // rss2json meletakkan media:thumbnail di item.thumbnail, dan enclosures di item.enclosures
    const enclosureImg = Array.isArray(item.enclosures)
      ? item.enclosures.find((e: any) => e.type?.startsWith("image") && e.link)?.link
      : null;

    function upgradeR2J(u: string): string {
      return u && u.startsWith("http://") ? u.replace("http://", "https://") : u;
    }
    let heroImage =
      (item.thumbnail && !TRACKING_IMG_URL.test(item.thumbnail) && item.thumbnail.startsWith("http"))
        ? upgradeR2J(item.thumbnail)
        : (enclosureImg && !TRACKING_IMG_URL.test(enclosureImg))
        ? upgradeR2J(enclosureImg)
        : (parsed.heroImage && !TRACKING_IMG_URL.test(parsed.heroImage))
        ? upgradeR2J(parsed.heroImage)
        : fallbackImg(cat);

    return {
      id: hashId(item.link || title),
      category: cat,
      title,
      summary: parsed.content[0] || title,
      content: parsed.content,
      source: source.name,
      sourceId: source.id,
      rssContentSufficient: parsed.sufficient,
      image: heroImage,
      contentHtml: parsed.contentHtml || undefined,
      readTime: Math.max(1, Math.ceil(scoreContent(parsed.contentHtml) / 1000)),
      publishedAt: relTime(item.pubDate),
      hot: i < 2,
      originalUrl: item.link || undefined,
    } as any;
  });
}

function parseXmlFeed(source: NewsSource, rawText: string, limit: number): Article[] {
  const clean = rawText
    .replace(/^\uFEFF/, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");

  let xml = new DOMParser().parseFromString(clean, "text/xml");
  if (xml.querySelector("parsererror")) {
    xml = new DOMParser().parseFromString(clean, "text/html");
  }

  const items = Array.from(xml.querySelectorAll("item, entry")).slice(0, limit);
  if (!items.length) throw new Error("No items in feed");

  return items.map((item, i) => {
    // Title — strip CDATA wrapper yang kadang lolos
    const rawTitle = item.querySelector("title")?.textContent ?? "Untitled";
    const title = decodeHtmlEntities(
      rawTitle.replace(/<!\[CDATA\[/gi, "").replace(/\]\]>/gi, "").trim()
    );

    const pubDate = item.querySelector("pubDate, published, updated")?.textContent ?? "";
    const link =
      item.querySelector("link")?.textContent?.trim() ||
      item.querySelector("link")?.getAttribute("href") ||
      "";

    // Konten: content:encoded (paling lengkap) > description > summary
    const rawContent =
      item.getElementsByTagNameNS(
        "http://purl.org/rss/1.0/modules/content/",
        "encoded"
      )[0]?.textContent ||
      item.getElementsByTagName("content:encoded")[0]?.textContent ||
      item.querySelector("description, summary, content")?.textContent ||
      "";

    const baseUrl = link || source.url;
    const tags = Array.from(item.querySelectorAll("category")).map(
      c => c.textContent?.trim() ?? ""
    );
    const cat = guessCategory(title, tags);

    const isYaraon = source.rssContentSufficient === true;
    const parsed = buildFromRssContent(rawContent, baseUrl, isYaraon || undefined, title);

    // Untuk Google News: nama sumber dari tag <source>
    let srcName = source.name;
    if ((source.feedUrl ?? "").includes("news.google.com")) {
      const gs = item.querySelector("source")?.textContent?.trim();
      if (gs) srcName = gs;
    }

    // Thumbnail: coba dari media:thumbnail, media:content, enclosure, lalu dari konten
    // PENTING: jangan pakai || chain dengan ternary — JS mem-parse a||b||c||d?e:f sebagai (a||b||c||d)?e:f
    const mediaNs = "http://search.yahoo.com/mrss/";
    const mediaThumbUrl = (() => {
      const mt = item.getElementsByTagNameNS(mediaNs, "thumbnail")[0]?.getAttribute("url");
      if (mt) return mt;
      const mc = item.getElementsByTagNameNS(mediaNs, "content")[0]?.getAttribute("url");
      if (mc) return mc;
      const encImg = item.querySelector("enclosure[type^='image']")?.getAttribute("url");
      if (encImg) return encImg;
      const encEl = item.querySelector("enclosure");
      if (encEl && (encEl.getAttribute("type") ?? "").startsWith("image"))
        return encEl.getAttribute("url") ?? "";
      return "";
    })();

    function upgradeHttp(u: string): string {
      return u.startsWith("http://") ? u.replace("http://", "https://") : u;
    }
    const rawThumb = mediaThumbUrl ? upgradeHttp(mediaThumbUrl) : "";
    const heroImage =
      (rawThumb && !TRACKING_IMG_URL.test(rawThumb) && rawThumb.startsWith("http"))
        ? rawThumb
        : (parsed.heroImage && !TRACKING_IMG_URL.test(parsed.heroImage))
        ? upgradeHttp(parsed.heroImage)
        : fallbackImg(cat);

    return {
      id: hashId(link || title),
      category: cat,
      title,
      summary: parsed.content[0] || title,
      content: parsed.content,
      source: srcName,
      sourceId: source.id,
      rssContentSufficient: parsed.sufficient,
      image: heroImage,
      contentHtml: parsed.contentHtml || undefined,
      readTime: Math.max(1, Math.ceil(scoreContent(parsed.contentHtml) / 1000)),
      publishedAt: relTime(pubDate),
      hot: i < 2,
      originalUrl: link || undefined,
    } as any;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// § 8. SOURCE FETCHERS
// ─────────────────────────────────────────────────────────────────────────────

async function fetchFromRSS(source: NewsSource, limit = 15): Promise<Article[]> {
  const feedUrl = source.feedUrl ?? source.url;

  // ① rss2json DULU — memberikan thumbnail, content terformat, dan metadata terlengkap
  // Skip untuk Google News (redirect chain tidak di-resolve dengan benar oleh rss2json)
  if (!feedUrl.includes("news.google.com")) {
    const j = await fetchRss2Json(feedUrl);
    if (j) return articlesFromR2J(source, j, limit);
  }

  // ② Server proxy /api/rss — fallback jika rss2json gagal (rate limit, HTTP feed, dll)
  // Di Vercel: serverless function. Di lokal: Express server.
  try {
    const res = await fetch(SERVER_RSS_PROXY + encodeURIComponent(feedUrl), {
      signal: AbortSignal.timeout(12000),
    });
    if (res.ok) {
      const text = await res.text();
      if (text.length > 200) return parseXmlFeed(source, text, limit);
    }
  } catch { /* lanjut ke public proxy */ }

  // ③ Public CORS proxy langsung untuk RSS — fetchWithFallback pakai /api/proxy (HTML), tidak cocok untuk XML
  for (const proxy of PUBLIC_PROXIES) {
    try {
      const res = await fetch(proxy + encodeURIComponent(feedUrl), {
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) continue;
      const text = await res.text();
      if (text.length > 200) return parseXmlFeed(source, text, limit);
    } catch { /* coba proxy berikutnya */ }
  }
  return []; // semua gagal
}

async function fetchFromWebsite(source: NewsSource, limit = 15): Promise<Article[]> {
  const rawUrl = /^https?:\/\//i.test(source.url)
    ? source.url
    : "https://" + source.url;

  const html = await fetchWithFallback(rawUrl);
  const doc = new DOMParser().parseFromString(html, "text/html");
  const hostname = new URL(rawUrl).hostname;
  const seen = new Set<string>();

  const links = Array.from(doc.querySelectorAll("a[href]"))
    .filter(a => {
      const href = (a as HTMLAnchorElement).href;
      const text = (a.textContent ?? "").trim();
      const ok =
        href.includes(hostname) &&
        !href.includes("#") &&
        !/\?(tag|cat|page|s)=/.test(href) &&
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
    return {
      id: hashId(href || title),
      category: cat,
      title,
      summary: title,
      content: [],
      source: source.name,
      image: fallbackImg(cat),
      readTime: 3,
      publishedAt: "Baru saja",
      hot: i < 2,
      originalUrl: href || undefined,
    } as Article;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// § 9. PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

export interface FetchAllResult {
  articles: Article[];
  errors: Record<string, string>;
  fromCache: boolean;
}

export async function fetchAllSources(
  sources: NewsSource[],
  onProgress?: (msg: string, done: number, total: number) => void
): Promise<FetchAllResult> {
  const enabled = sources.filter(s => s.enabled);
  const errors: Record<string, string> = {};
  const all: Article[] = [];

  await Promise.allSettled(
    enabled.map(async (source, idx) => {
      onProgress?.("Mengambil " + source.name + "...", idx, enabled.length);
      try {
        const arts =
          source.type === "rss"
            ? await fetchFromRSS(source, 15)
            : await fetchFromWebsite(source, 15);
        all.push(...arts);
        updateSourceMeta(source.id, {
          lastFetched: new Date().toISOString(),
          articleCount: arts.length,
          error: undefined,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors[source.id] = msg;
        updateSourceMeta(source.id, { error: msg });
      }
    })
  );

  onProgress?.("Selesai", enabled.length, enabled.length);
  return { articles: all, errors, fromCache: false };
}

const cache = new Map<string, { articles: Article[]; ts: number }>();
const TTL = 15 * 60 * 1000; // 15 menit

export async function fetchAllSourcesCached(
  sources: NewsSource[],
  forceRefresh = false,
  onProgress?: (msg: string, done: number, total: number) => void
): Promise<FetchAllResult> {
  const key = sources
    .filter(s => s.enabled)
    .map(s => s.id)
    .join(",");

  if (!forceRefresh) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.ts < TTL)
      return { articles: hit.articles, errors: {}, fromCache: true };
  }

  const result = await fetchAllSources(sources, onProgress);
  if (result.articles.length > 0)
    cache.set(key, { articles: result.articles, ts: Date.now() });
  return result;
}

export function clearAllSourceCache(): void {
  cache.clear();
}