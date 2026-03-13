import type { Article } from "../data/articles";

export type AIProvider = "google" | "anthropic" | "openai" | "openrouter";

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
}

// ── 1. KONFIGURASI MODEL ──────────────────────────────────────────────────────

export const PROVIDER_MODELS: Record<AIProvider, { label: string; models: { id: string; label: string }[] }> = {
  google: {
    label: "Google Gemini",
    models: [
      { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite (New Preview)" },
      { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite (Cepat & Hemat)" },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (Standar)" },
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro (Paling Pintar)" },
    ],
  },
  anthropic: {
    label: "Anthropic Claude",
    models: [
      { id: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet" },
      { id: "claude-3-opus-latest", label: "Claude 3 Opus" },
      { id: "claude-3-haiku-20240307", label: "Claude 3 Haiku" },
    ],
  },
  openai: {
    label: "OpenAI GPT",
    models: [
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-4o-mini", label: "GPT-4o Mini (Cepat & Murah)" },
      { id: "gpt-4-turbo", label: "GPT-4 Turbo" },
    ],
  },
  openrouter: {
    label: "OpenRouter",
    models: [
      { id: "google/gemini-2.5-flash-lite-preview-09-2025:free", label: "Gemini 2.5 Flash Lite (Gratis)" },
      { id: "google/gemini-2.0-flash-exp:free", label: "Gemini 2.0 Flash (Gratis)" },
      { id: "deepseek/deepseek-chat", label: "DeepSeek V3" },
      { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet via OR" },
    ],
  },
};

const AI_CONFIG_KEY = "discuss_ai_config";

export const DEFAULT_AI_CONFIG: AIConfig = {
  provider: "google",
  apiKey: "",
  model: "gemini-2.5-flash-lite", 
};

export function getAIConfig(): AIConfig {
  try {
    const raw = localStorage.getItem(AI_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AIConfig;
      if (parsed.apiKey && parsed.provider && parsed.model) return parsed;
    }
  } catch (_) {}
  return { ...DEFAULT_AI_CONFIG };
}

export function saveAIConfig(config: AIConfig): void {
  localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
}

// ── 2. PROMPTS ────────────────────────────────────────────────────────────────

const PROMPT_NEWS = `Kamu adalah editor berita profesional media online Indonesia.
Tulis ulang artikel dari bahasa asing menjadi artikel berita Bahasa Indonesia yang formal, informatif, dan enak dibaca.

ATURAN:
- Judul: max 80 karakter, gaya berita Indonesia. Gunakan BOLD (contoh: **Headline**) pada kata kunci yang paling penting/menarik.
- Isi: 4-6 paragraf, masing-masing 2-4 kalimat, BAHASA INDONESIA baku
- Summary: 1-2 kalimat ringkas, max 150 karakter
- Kategori: Hot Topic | Breaking | Trending | Discuss | Opinion | Analisis | Review | Exclusive

RESPONSE HARUS BERUPA JSON (tanpa markdown blok):
{"title":"...","summary":"...","content":["par1","par2","par3"],"category":"..."}`;

const PROMPT_COMMUNITY = `Kamu adalah editor media online Indonesia yang ahli meliput tren diskusi komunitas internet Jepang.
Baca topik diskusi berikut, pahami konteksnya, lalu tulis artikel berita feature Bahasa Indonesia yang menarik.

CARA MENULIS:
- Judul: catchy, mencerminkan inti diskusi, max 80 karakter. Gunakan BOLD (contoh: **Sesuatu**) pada kata kunci utama.
- Paragraf 1: jelaskan topik/isu yang sedang viral
- Paragraf 2-4: rangkum pendapat dan reaksi netizen secara berimbang
- Paragraf 5: konteks & kesimpulan
- Kategori: Hot Topic | Discuss | Trending | Opinion | Analisis

RESPONSE HARUS BERUPA JSON (tanpa markdown blok):
{"title":"...","summary":"...","content":["par1","par2","par3"],"category":"..."}`;

// ── 3. API CALLERS ────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function callGoogle(config: AIConfig, system: string, user: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: { 
      maxOutputTokens: 2000, 
      temperature: 0.7,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING", description: "Judul berita, maksimal 80 karakter" },
          summary: { type: "STRING", description: "Ringkasan berita 1-2 kalimat, maksimal 150 karakter" },
          content: { 
            type: "ARRAY", 
            description: "Isi berita, masing-masing elemen array adalah 1 paragraf",
            items: { type: "STRING" } 
          },
          category: { type: "STRING" }
        },
        required: ["title", "summary", "content", "category"]
      }
    },
  });

  const delays = [5000, 15000, 30000];
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });

    if (res.status === 429) {
      if (attempt < delays.length) { await sleep(delays[attempt]); continue; }
      throw new Error("Rate limit Gemini terlampaui. Coba lagi nanti.");
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err?.error?.message ?? JSON.stringify(err);
      if (res.status === 404) throw new Error(`Model '${config.model}' tidak ditemukan.`);
      if (msg.includes("content_free_tier") || msg.includes("RESOURCE_EXHAUSTED")) throw new Error("Quota habis.");
      throw new Error(`Gemini Error (${res.status}): ${msg}`);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }
  throw new Error("Gagal menghubungi Gemini.");
}

async function callAnthropic(config: AIConfig, system: string, user: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-calls": "true",
    },
    body: JSON.stringify({ model: config.model, max_tokens: 2000, system: system, messages: [{ role: "user", content: user }] }),
  });
  if (!res.ok) {
     const err = await res.json().catch(() => ({}));
     throw new Error(`Anthropic Error: ${err?.error?.message || res.status}`);
  }
  const data = await res.json();
  return data.content?.filter((b: {type:string}) => b.type === "text").map((b: {text:string}) => b.text).join("") ?? "";
}

async function callOpenAI(config: AIConfig, system: string, user: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + config.apiKey },
    body: JSON.stringify({
      model: config.model, max_tokens: 2000,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      response_format: { 
        type: "json_schema",
        json_schema: {
          name: "rewrite_response",
          strict: true,
          schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              summary: { type: "string" },
              content: { type: "array", items: { type: "string" } },
              category: { type: "string" }
            },
            required: ["title", "summary", "content", "category"],
            additionalProperties: false
          }
        }
      }
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`OpenAI Error: ${err?.error?.message || res.status}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callOpenRouter(config: AIConfig, system: string, user: string): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + config.apiKey,
      "HTTP-Referer": "https://discuss.app",
      "X-Title": "Discuss News App",
    },
    body: JSON.stringify({ model: config.model, max_tokens: 2000, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
  });
  if (!res.ok) throw new Error("OpenRouter " + res.status);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callAI(system: string, user: string): Promise<string> {
  const config = getAIConfig();
  if (!config.apiKey) throw new Error("API key belum diset di Pengaturan");
  
  if (config.provider === "google") return callGoogle(config, system, user);
  if (config.provider === "anthropic") return callAnthropic(config, system, user);
  if (config.provider === "openai") return callOpenAI(config, system, user);
  return callOpenRouter(config, system, user);
}

// ── 4. LOGIC REWRITE & FILTER KETAT ──────────────────────────────────────────

const PROMPT_STORAGE_KEY = "discuss_ai_prompt";

function getSystemPrompt(isCommunity: boolean): string {
  const custom = localStorage.getItem(PROMPT_STORAGE_KEY);
  if (custom && !isCommunity) return custom;
  return isCommunity ? PROMPT_COMMUNITY : PROMPT_NEWS;
}

const CACHE_KEY = "ai_rewrite_cache_v1";
const CACHE_MAX = 30; // simpan maksimal 30 artikel

function loadCache(): Map<string, Article> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return new Map();
    const entries = JSON.parse(raw) as [string, Article][];
    return new Map(entries);
  } catch { return new Map(); }
}

function saveCache(cache: Map<string, Article>) {
  try {
    // Batasi ukuran cache — buang entri terlama jika melebihi CACHE_MAX
    let entries = Array.from(cache.entries());
    if (entries.length > CACHE_MAX) entries = entries.slice(entries.length - CACHE_MAX);
    localStorage.setItem(CACHE_KEY, JSON.stringify(entries));
  } catch { /* storage penuh, abaikan */ }
}

const rewriteCache: Map<string, Article> = loadCache();

export function getCachedRewrite(articleId: string): Article | null {
  return rewriteCache.get(articleId) ?? null;
}

export function isCommunitySource(sourceId?: string, sourceName?: string): boolean {
  if (!sourceId && !sourceName) return false;
  const communityIds = ["yaraon", "otakomu", "esuteru"];
  const communityKeywords = ["やらおん", "まとめ", "matome", "2ch", "5ch", "bbs"];
  if (sourceId && communityIds.includes(sourceId)) return true;
  if (sourceName) {
    const lowerName = sourceName.toLowerCase();
    for (const kw of communityKeywords) { if (lowerName.includes(kw)) return true; }
  }
  return false;
}

export interface RewriteResult {
  title: string;
  summary: string;
  content: string[];
  category: string;
}

export async function rewriteArticleOnDemand(
  article: Article & { originalUrl?: string; sourceId?: string },
  extraContent?: string,
): Promise<Article> {
  const cached = rewriteCache.get(article.id);
  if (cached) return cached;

  const isCommunity = isCommunitySource(article.sourceId, article.source);
  const systemPrompt = getSystemPrompt(isCommunity);

  // ── FILTER NOISE: Membuang kalimat/paragraf yang jelas-jelas bukan konten ──
  const isNoise = (text: string) => {
    const t = text.trim().toLowerCase();
    if (t.length < 25) return true; // Buang teks terlalu pendek (biasanya menu/tombol)
    if (/^(baca juga|read also|related|lihat juga|artikel terkait|rekomendasi|selengkapnya|sumber:|tags:)/i.test(t)) return true; // Buang link terkait
    return false;
  };

  const parts: string[] = [`Judul Asli: ${article.title}`];
  
  const bodyText = (() => {
    // Coba ambil dari blocks
    if (article.blocks && article.blocks.length > 0) {
      const txt = article.blocks
        .filter(b => b.type === 'text' && b.text && b.text !== article.title)
        .map(b => b.text!.replace(/<[^>]+>/g, '').trim()) // Hapus sisa tag HTML
        .filter(t => !isNoise(t)) // Saring noise
        .join('\n\n');
      if (txt.length > 100) return txt;
    }
    // Coba ambil dari content array
    if ((article.content ?? []).length > 0) {
      const txt = (article.content ?? [])
        .filter(c => c !== article.title)
        .map(c => c.replace(/<[^>]+>/g, '').trim())
        .filter(t => !isNoise(t))
        .join('\n\n');
      if (txt.length > 100) return txt;
    }
    // Fallback dari HTML (Jika berasal dari Vercel/Readability)
    const html = (article as any).contentHtml ?? '';
    if (html) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      
      // Hapus paksa elemen yang biasanya berisi daftar link / sampah
      doc.querySelectorAll('ul, ol, nav, aside, footer, .related, .baca-juga, iframe, script').forEach(el => el.remove());

      // HANYA ambil tag Paragraf dan Heading
      const text = Array.from(doc.querySelectorAll('p, h2, h3'))
        .map(el => el.textContent?.trim() ?? '')
        .filter(t => !isNoise(t))
        .join('\n\n');
      return text;
    }
    return '';
  })();

  if (bodyText.length > 0) {
    parts.push('Isi Artikel Asli:', bodyText);
  } else {
    parts.push('Isi Artikel Asli:', article.summary ?? "Tidak ada deskripsi rinci.");
  }
  
  if (extraContent) {
    parts.push('Konteks Tambahan:', extraContent);
  }

  const userPrompt = parts.join("\n\n");

  try {
    const rawText = await callAI(systemPrompt, userPrompt);
    
    let cleaned = rawText.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(json)?|```$/gi, "").trim();
    }
    cleaned = cleaned.replace(/[\u0000-\u0019]+/g, ""); // Hapus tab/enter mentah penyebab Unterminated String

    let parsed: RewriteResult;
    try {
      parsed = JSON.parse(cleaned) as RewriteResult;
    } catch (parseError) {
      console.warn("JSON Parse standar gagal, mencoba metode Regex darurat...");
      const titleMatch = cleaned.match(/"title"\s*:\s*"([^"]*)"/i);
      const summaryMatch = cleaned.match(/"summary"\s*:\s*"([^"]*)"/i);
      const categoryMatch = cleaned.match(/"category"\s*:\s*"([^"]*)"/i);
      
      if (titleMatch) {
        parsed = {
          title: titleMatch[1],
          summary: summaryMatch ? summaryMatch[1] : article.summary ?? "",
          category: categoryMatch ? categoryMatch[1] : article.category,
          content: [
            "Catatan Sistem: AI mengalami sedikit kendala format. Berikut adalah hasil terjemahan darurat:", 
            (summaryMatch ? summaryMatch[1] : "Silakan coba buat artikel ulang.")
          ]
        };
      } else {
         throw new Error("AI membalas dengan format yang benar-benar rusak. Silakan coba klik Buat Artikel lagi.");
      }
    }
    
    const wordCount = parsed.content.join(" ").split(/\s+/).length;

    let rebuiltBlocks = article.blocks;
    if (article.blocks && article.blocks.length > 0 && parsed.content.length > 0) {
      const aiParagraphs = [...parsed.content];
      let aiIdx = 0;
      rebuiltBlocks = article.blocks.map(b => {
        if (b.type === 'image') return b; 
        if (b.type === 'text' && aiIdx < aiParagraphs.length) {
          return { ...b, text: aiParagraphs[aiIdx++] };
        }
        return b;
      });
      while (aiIdx < aiParagraphs.length) {
        rebuiltBlocks.push({ type: 'text', tag: 'p', text: aiParagraphs[aiIdx++] });
      }
    }

    const result: Article = {
      ...article,
      title: parsed.title,
      summary: parsed.summary,
      content: parsed.content,
      blocks: rebuiltBlocks,
      category: parsed.category || article.category,
      readTime: Math.max(1, Math.round(wordCount / 200)),
    };

    rewriteCache.set(article.id, result);
    saveCache(rewriteCache);
    return result;
  } catch (e: any) {
    console.error("AI Rewrite Failed:", e);
    throw e;
  }
}

export function clearRewriteCache() {
  rewriteCache.clear();
  try { localStorage.removeItem(CACHE_KEY); } catch { }
}