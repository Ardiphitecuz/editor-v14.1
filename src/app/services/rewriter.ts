import type { Article } from "../data/articles";

export type AIProvider = "google" | "anthropic" | "openai" | "openrouter";

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
}

// ── 1. KONFIGURASI MODEL (UPDATED SESUAI DOKUMENTASI RESMI) ───────────────────

export const PROVIDER_MODELS: Record<AIProvider, { label: string; models: { id: string; label: string }[] }> = {
  google: {
    label: "Google Gemini",
    models: [
      // TERBARU (Preview)
      { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite (New Preview)" },
      
      // STABIL (Versi 2.5 Recommended)
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
  // Menggunakan model stabil terbaru sebagai default
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
- Judul: max 80 karakter, gaya berita Indonesia
- Isi: 4-6 paragraf, masing-masing 2-4 kalimat, BAHASA INDONESIA baku
- Summary: 1-2 kalimat ringkas, max 150 karakter
- Kategori: Hot Topic | Breaking | Trending | Discuss | Opinion | Analisis | Review | Exclusive
- Tetap faktual
- HINDARI markdown bold (**) berlebihan di dalam paragraf.

RESPONSE hanya JSON raw (tanpa backtick):
{"title":"...","summary":"...","content":["par1","par2","par3","par4"],"category":"..."}`;

const PROMPT_COMMUNITY = `Kamu adalah editor media online Indonesia yang ahli meliput tren diskusi komunitas internet Jepang.

Baca topik diskusi berikut, pahami konteksnya, lalu tulis artikel berita feature Bahasa Indonesia yang menarik.

CARA MENULIS:
- Judul: catchy, mencerminkan inti diskusi, max 80 karakter
- Paragraf 1: jelaskan topik/isu yang sedang viral
- Paragraf 2-4: rangkum pendapat dan reaksi netizen secara berimbang
- Paragraf 5: konteks & kesimpulan
- Tone: informatif tapi engaging, seperti artikel trending
- Summary: 1-2 kalimat yang menggambarkan inti diskusi, max 150 karakter
- Kategori: Hot Topic | Discuss | Trending | Opinion | Analisis

RESPONSE hanya JSON raw (tanpa backtick):
{"title":"...","summary":"...","content":["par1","par2","par3","par4","par5"],"category":"..."}`;

// ── 3. API CALLERS ────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function callGoogle(config: AIConfig, system: string, user: string): Promise<string> {
  // Menggunakan v1beta agar kompatibel dengan model terbaru & systemInstruction
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
  
  const body = JSON.stringify({
    systemInstruction: {
      parts: [{ text: system }]
    },
    contents: [{ 
      role: "user", 
      parts: [{ text: user }] 
    }],
    generationConfig: { 
      maxOutputTokens: 2000, 
      temperature: 0.7,
      responseMimeType: "application/json" // Memastikan output JSON
    },
  });

  const delays = [5000, 15000, 30000];
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    if (res.status === 429) {
      if (attempt < delays.length) {
        await sleep(delays[attempt]);
        continue;
      }
      throw new Error("Rate limit Gemini terlampaui. Coba lagi nanti atau ganti model.");
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err?.error?.message ?? JSON.stringify(err);
      
      if (res.status === 404) {
         throw new Error(`Model '${config.model}' tidak ditemukan atau belum tersedia untuk API Key Anda. Coba ganti ke Gemini 2.5 Flash Lite.`);
      }
      
      if (msg.includes("content_free_tier") || msg.includes("RESOURCE_EXHAUSTED")) {
        throw new Error("Quota gratis Gemini habis. Gunakan API key baru atau model lain.");
      }
      throw new Error(`Gemini Error (${res.status}): ${msg}`);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }
  throw new Error("Gagal menghubungi Gemini setelah beberapa percobaan.");
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
    body: JSON.stringify({
      model: config.model,
      max_tokens: 2000,
      system: system,
      messages: [{ role: "user", content: user }],
    }),
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
      model: config.model,
      max_tokens: 2000,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      response_format: { type: "json_object" }
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
    body: JSON.stringify({
      model: config.model,
      max_tokens: 2000,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
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

// ── 4. LOGIC REWRITE ──────────────────────────────────────────────────────────

const PROMPT_STORAGE_KEY = "discuss_ai_prompt";

function getSystemPrompt(isCommunity: boolean): string {
  const custom = localStorage.getItem(PROMPT_STORAGE_KEY);
  if (custom && !isCommunity) return custom;
  return isCommunity ? PROMPT_COMMUNITY : PROMPT_NEWS;
}

const rewriteCache = new Map<string, Article>();

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
    for (const kw of communityKeywords) {
      if (lowerName.includes(kw)) return true;
    }
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

  const parts: string[] = [`Judul Asli: ${article.title}`];
  
  if (article.content && article.content.length > 0) {
    // Filter konten duplikat judul jika ada
    const contentText = article.content
        .filter(c => c !== article.title)
        .join("\n\n");
    parts.push("Isi Artikel Asli:", contentText);
  }
  
  if (extraContent) {
    parts.push("Konteks Tambahan:", extraContent);
  }

  const userPrompt = parts.join("\n\n");

  try {
    const rawText = await callAI(systemPrompt, userPrompt);
    
    // Pembersihan JSON yang lebih robust
    let cleaned = rawText.trim();
    // Hapus markdown code block jika ada
    if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(json)?|```$/g, "");
    }
    
    const parsed = JSON.parse(cleaned) as RewriteResult;
    
    const wordCount = parsed.content.join(" ").split(/\s+/).length;

    const result: Article = {
      ...article,
      title: parsed.title,
      summary: parsed.summary,
      content: parsed.content,
      category: parsed.category || article.category,
      readTime: Math.max(1, Math.round(wordCount / 200)),
    };

    rewriteCache.set(article.id, result);
    return result;
  } catch (e: any) {
    console.error("AI Rewrite Failed:", e);
    throw e;
  }
}

export function clearRewriteCache() {
  rewriteCache.clear();
}