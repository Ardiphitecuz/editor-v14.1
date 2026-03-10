// File: src/app/components/SettingsPage.tsx
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  ArrowLeft, Plus, Trash2, ToggleLeft, ToggleRight,
  Globe, Rss, Loader2, CheckCircle2, XCircle, AlertCircle,
  RefreshCw, ChevronRight, Radio, Eye, EyeOff, Key, Bot, Search,
} from "lucide-react";
import { toast } from "sonner";
import {
  getSources, addSource, removeSource, toggleSource,
  detectSourceType, buildGoogleNewsUrl, isGoogleNewsUrl, type NewsSource,
} from "../services/sourceManager";
import { clearAllSourceCache } from "../services/newsFetcher";
import {
  clearRewriteCache, getAIConfig, saveAIConfig,
  PROVIDER_MODELS, type AIProvider, type AIConfig,
} from "../services/rewriter";

const LANG_LABELS: Record<string, string> = {
  ja: "Jepang", en: "Inggris", id: "Indonesia",
  ko: "Korea", zh: "Mandarin", es: "Spanyol", pt: "Portugis",
};

function langLabel(lang: string) {
  return LANG_LABELS[lang] ?? lang.toUpperCase();
}

const KEY_URLS: Record<AIProvider, string> = {
  google: "https://aistudio.google.com/apikey",
  anthropic: "https://console.anthropic.com",
  openai: "https://platform.openai.com/api-keys",
  openrouter: "https://openrouter.ai/keys",
};

// ── Source Card ───────────────────────────────────────────────────────────────

function SourceCard({ source, onToggle, onRemove }: {
  source: NewsSource; onToggle: () => void; onRemove: () => void;
}) {
  const isDefault = source.id === "yaraon";
  const isGoogle = isGoogleNewsUrl(source.feedUrl ?? source.url);
  
  // Generate avatar background color based on source name
  const getAvatarBg = (name: string) => {
    const colors = ["#ff742f", "#4285f4", "#34a853", "#fbbc04", "#ea4335", "#9c27b0"];
    const hash = name.charCodeAt(0);
    return colors[hash % colors.length];
  };

  // Get time ago from last fetch and color based on age (green->yellow->red)
  const getTimeAgoWithColor = (timestamp?: number) => {
    if (!timestamp) return { text: null, color: "#9ca3af", bgColor: "#f3f4f6" };
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    let text = "";
    let color = "";
    let bgColor = "";
    
    if (mins < 1) { text = "Now"; color = "#10b981"; bgColor = "#d1fae5"; }
    else if (mins < 30) { text = `${mins}m`; color = "#10b981"; bgColor = "#d1fae5"; }
    else if (mins < 60) { text = `${mins}m`; color = "#eab308"; bgColor = "#fef3c7"; }
    else if (hours < 6) { text = `${hours}h`; color = "#f97316"; bgColor = "#fed7aa"; }
    else { text = `${hours}h+`; color = "#ef4444"; bgColor = "#fee2e2"; }
    
    return { text, color, bgColor };
  };

  const timeInfo = getTimeAgoWithColor(source.lastFetched ? new Date(source.lastFetched).getTime() : undefined);
  
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 rounded-xl transition-colors border border-neutral-200" style={{ opacity: source.enabled ? 1 : 0.5 }}>
      {/* Toggle Switch */}
      <button onClick={onToggle} className="shrink-0 hover:opacity-80 transition-opacity">
        {source.enabled
          ? <ToggleRight size={24} className="text-[#ff742f]" />
          : <ToggleLeft size={24} className="text-gray-400" />}
      </button>

      {/* Avatar */}
      <div 
        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
        style={{ backgroundColor: getAvatarBg(source.name) }}
      >
        {source.name.charAt(0).toUpperCase()}
      </div>

      {/* Source Info */}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-900 text-sm truncate">{source.name}</p>
        <p className="text-gray-500 text-xs truncate">{source.feedUrl ?? source.url}</p>
      </div>

      {/* Time Badge with Dynamic Color */}
      {timeInfo.text && (
        <div className="flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-lg" style={{ background: timeInfo.bgColor }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: timeInfo.color }}></span>
          <span className="text-xs font-medium" style={{ color: timeInfo.color }}>{timeInfo.text}</span>
        </div>
      )}

      {/* Action Icons - Hide on mobile to prevent overflow */}
      <div className="flex items-center gap-1 shrink-0 hidden sm:flex">
        <button className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors text-gray-500 hover:text-gray-700" title="View">
          <Eye size={16} />
        </button>
        <button className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors text-gray-500 hover:text-gray-700" title="RSS">
          <Rss size={16} />
        </button>
        <button className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors text-gray-500 hover:text-gray-700" title="Alert">
          <AlertCircle size={16} />
        </button>
        <button className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors text-gray-500 hover:text-gray-700" title="Search">
          <Search size={16} />
        </button>
        {!isDefault && (
          <button onClick={onRemove} className="p-1.5 hover:bg-red-100 rounded-lg transition-colors text-gray-500 hover:text-red-600" title="Remove">
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Add Source Modal ──────────────────────────────────────────────────────────

type AddMode = "url" | "googlenews";

function AddSourceModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [mode, setMode] = useState<AddMode>("url");
  const [url, setUrl] = useState("");
  const [language, setLanguage] = useState("id");
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState<{ type: "rss" | "website"; feedUrl?: string; name?: string } | null>(null);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [gnQuery, setGnQuery] = useState("");
  const [gnLang, setGnLang] = useState("id");
  const [gnCountry, setGnCountry] = useState("ID");

  const GN_LANGS = [
    { code: "id", country: "ID", label: "Indonesia" },
    { code: "en", country: "US", label: "Inggris (US)" },
    { code: "en", country: "GB", label: "Inggris (UK)" },
    { code: "ja", country: "JP", label: "Jepang" },
    { code: "ko", country: "KR", label: "Korea" },
    { code: "zh", country: "CN", label: "Mandarin" },
    { code: "es", country: "ES", label: "Spanyol" },
    { code: "pt", country: "BR", label: "Portugis" },
  ];

  async function handleDetect() {
    if (!url.trim()) return;
    setDetecting(true); setDetected(null); setDetectError(null);
    try {
      const result = await detectSourceType(url.trim());
      setDetected(result);
    } catch {
      setDetectError("Tidak bisa mengakses URL ini.");
    } finally {
      setDetecting(false);
    }
  }

  function handleAddUrl() {
    if (!detected) return;
    const cleanUrl = url.trim();
    const withProto = /^https?:\/\//i.test(cleanUrl) ? cleanUrl : "https://" + cleanUrl;
    let hostname = cleanUrl;
    try { hostname = new URL(withProto).hostname; } catch { /* use raw url */ }
    addSource({ name: detected.name ?? hostname, url: withProto, feedUrl: detected.feedUrl, type: detected.type, language, enabled: true });
    clearAllSourceCache(); clearRewriteCache();
    onAdded(); onClose();
  }

  function handleAddGoogleNews() {
    if (!gnQuery.trim()) return;
    const feedUrl = buildGoogleNewsUrl(gnQuery.trim(), gnLang, gnCountry);
    addSource({ name: "Google News: " + gnQuery.trim(), url: feedUrl, feedUrl, type: "rss", language: gnLang, enabled: true });
    clearAllSourceCache(); clearRewriteCache();
    onAdded(); onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="w-full bg-white rounded-t-3xl p-6 flex flex-col gap-5" style={{ maxHeight: "85vh", overflowY: "auto", paddingBottom: "90px" }}>
        <div className="flex items-center justify-between">
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "#1a1a1a" }}>Tambah Sumber Berita</h2>
          <button onClick={onClose}><XCircle size={22} className="text-neutral-400" /></button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setMode("url")}
            className="flex-1 py-2.5 rounded-xl font-bold transition-all"
            style={{ background: mode === "url" ? "#ff742f" : "#f0ede9", color: mode === "url" ? "white" : "#555", fontSize: 13 }}
          >
            URL / RSS Feed
          </button>
          <button
            onClick={() => setMode("googlenews")}
            className="flex-1 py-2.5 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5"
            style={{ background: mode === "googlenews" ? "#4285f4" : "#f0ede9", color: mode === "googlenews" ? "white" : "#555", fontSize: 13 }}
          >
            <Search size={14} />
            Google News
          </button>
        </div>

        {mode === "url" && (
          <>
            <div className="flex flex-col gap-2">
              <label style={{ fontSize: 13, fontWeight: 700, color: "#333" }}>URL Website / RSS Feed</label>
              <div className="flex gap-2">
                <input
                  type="url" value={url}
                  onChange={(e) => { setUrl(e.target.value); setDetected(null); setDetectError(null); }}
                  placeholder="https://contoh.com/feed"
                  className="flex-1 rounded-xl border border-neutral-200 px-3 py-2.5 focus:outline-none"
                  style={{ fontSize: 13 }}
                />
                <button onClick={handleDetect} disabled={detecting || !url.trim()}
                  className="px-4 py-2.5 rounded-xl bg-[#ff742f] text-white font-bold disabled:opacity-50 shrink-0" style={{ fontSize: 13 }}>
                  {detecting ? <Loader2 size={16} className="animate-spin" /> : "Cek"}
                </button>
              </div>
              {detectError && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-200">
                  <AlertCircle size={14} className="text-red-400 shrink-0" />
                  <p style={{ fontSize: 12, color: "#b91c1c" }}>{detectError}</p>
                </div>
              )}
              {detected && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-50 border border-green-200">
                  <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                  <p style={{ fontSize: 12, color: "#166534" }}>
                    {"Terdeteksi: " + (detected.type === "rss" ? "RSS Feed" : "Website") + (detected.name ? " - " + detected.name : "")}
                  </p>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <label style={{ fontSize: 13, fontWeight: 700, color: "#333" }}>Bahasa konten</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(LANG_LABELS).map(([code, label]) => (
                  <button key={code} onClick={() => setLanguage(code)}
                    className="px-3 py-1.5 rounded-full font-bold"
                    style={{ background: language === code ? "#ff742f" : "#f0ede9", color: language === code ? "white" : "#555", fontSize: 12 }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3 sticky bottom-0 bg-white pt-3 pb-1 -mx-6 px-6" style={{ marginTop: "auto" }}>
              <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-neutral-200 text-neutral-600 font-bold" style={{ fontSize: 14 }}>Batal</button>
              <button onClick={handleAddUrl} disabled={!detected} className="flex-1 py-3 rounded-xl bg-[#ff742f] text-white font-bold disabled:opacity-50" style={{ fontSize: 14 }}>Tambahkan</button>
            </div>
          </>
        )}

        {mode === "googlenews" && (
          <>
            <div className="flex flex-col gap-2">
              <label style={{ fontSize: 13, fontWeight: 700, color: "#333" }}>Topik / Kata Kunci</label>
              <input
                type="text" value={gnQuery}
                onChange={(e) => setGnQuery(e.target.value)}
                placeholder="Contoh: teknologi AI, bola, politik Indonesia..."
                className="rounded-xl border border-neutral-200 px-3 py-2.5 focus:outline-none"
                style={{ fontSize: 13 }}
              />
              <p style={{ fontSize: 11, color: "#888" }}>
                Akan mengambil berita terkini dari Google News sesuai kata kunci
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <label style={{ fontSize: 13, fontWeight: 700, color: "#333" }}>Bahasa & Negara</label>
              <div className="flex flex-col gap-1.5">
                {GN_LANGS.map((l) => (
                  <button key={l.code + l.country}
                    onClick={() => { setGnLang(l.code); setGnCountry(l.country); }}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-left"
                    style={{
                      borderColor: gnLang === l.code && gnCountry === l.country ? "#4285f4" : "#e5e5e5",
                      background: gnLang === l.code && gnCountry === l.country ? "#f0f5ff" : "white",
                    }}>
                    <span style={{ fontSize: 13, color: "#333" }}>{l.label}</span>
                    {gnLang === l.code && gnCountry === l.country && <CheckCircle2 size={16} className="text-blue-500" />}
                  </button>
                ))}
              </div>
            </div>
            {gnQuery && (
              <div className="px-3 py-2.5 rounded-xl bg-blue-50 border border-blue-200">
                <p style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 600 }}>Preview RSS URL:</p>
                <p className="truncate" style={{ fontSize: 10, color: "#3b82f6", marginTop: 2 }}>
                  {buildGoogleNewsUrl(gnQuery, gnLang, gnCountry)}
                </p>
              </div>
            )}
            <div className="flex gap-3 sticky bottom-0 bg-white pt-3 pb-1 -mx-6 px-6" style={{ marginTop: "auto" }}>
              <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-neutral-200 text-neutral-600 font-bold" style={{ fontSize: 14 }}>Batal</button>
              <button onClick={handleAddGoogleNews} disabled={!gnQuery.trim()}
                className="flex-1 py-3 rounded-xl text-white font-bold disabled:opacity-50"
                style={{ background: "#4285f4", fontSize: 14 }}>
                Tambahkan
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── AI Config Section ─────────────────────────────────────────────────────────

const DEFAULT_PROMPT = `Kamu adalah editor berita profesional media online Indonesia.
Tulis ulang artikel dari bahasa asing menjadi artikel berita Bahasa Indonesia yang formal, informatif, dan enak dibaca.

ATURAN:
- Judul: max 80 karakter, gaya berita Indonesia
- Isi: 4-6 paragraf, masing-masing 2-4 kalimat, BAHASA INDONESIA baku
- Summary: 1-2 kalimat ringkas, max 150 karakter
- Kategori: Hot Topic | Breaking | Trending | Discuss | Opinion | Analisis | Review | Exclusive
- Tetap faktual

RESPONSE hanya JSON:
{"title":"...","summary":"...","content":["par1","par2","par3","par4"],"category":"..."}`;

const PROMPT_STORAGE_KEY = "discuss_ai_prompt";

function AIConfigSection() {
  const [config, setConfig] = useState<AIConfig>(() => {
    const cfg = getAIConfig();
    // Validate model — if stored model not in list, reset to default
    const validModels = PROVIDER_MODELS[cfg.provider]?.models.map(m => m.id) ?? [];
    if (!validModels.includes(cfg.model)) {
      const fixed = { ...cfg, model: PROVIDER_MODELS[cfg.provider]?.models[0]?.id ?? "gemini-2.0-flash-lite" };
      saveAIConfig(fixed);
      return fixed;
    }
    return cfg;
  });
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [customPrompt, setCustomPrompt] = useState<string>(
    () => localStorage.getItem(PROMPT_STORAGE_KEY) ?? DEFAULT_PROMPT
  );

  function handleProviderChange(provider: AIProvider) {
    const defaultModel = PROVIDER_MODELS[provider].models[0].id;
    setConfig({ provider, model: defaultModel, apiKey: "" });
    setSaved(false);
  }

  function handleSave() {
    saveAIConfig(config);
    localStorage.setItem(PROMPT_STORAGE_KEY, customPrompt);
    clearRewriteCache();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function handleResetConfig() {
    if (!confirm("Reset semua konfigurasi AI ke default?")) return;
    const def = { provider: "google" as AIProvider, apiKey: "", model: "gemini-2.0-flash-lite" };
    setConfig(def);
    saveAIConfig(def);
    setCustomPrompt(DEFAULT_PROMPT);
    localStorage.removeItem(PROMPT_STORAGE_KEY);
    clearRewriteCache();
    setSaved(false);
  }

  const providerInfo = PROVIDER_MODELS[config.provider];
  const keyUrl = KEY_URLS[config.provider];

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
      <div className="px-4 pt-4 pb-4 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Bot size={18} className="text-[#ff742f]" />
          <h2 style={{ fontSize: 15, fontWeight: 800, color: "#1a1a1a" }}>Konfigurasi AI Rewriter</h2>
        </div>

        <div className="flex flex-col gap-2">
          <label style={{ fontSize: 12, fontWeight: 700, color: "#555" }}>Provider AI</label>
          <div className="flex flex-col gap-2">
            {(Object.keys(PROVIDER_MODELS) as AIProvider[]).map((provider) => (
              <button key={provider} onClick={() => handleProviderChange(provider)}
                className="flex items-center justify-between px-3 py-3 rounded-xl border-2 transition-all text-left"
                style={{ borderColor: config.provider === provider ? "#ff742f" : "#e5e5e5", background: config.provider === provider ? "#fff8f4" : "white" }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }}>{PROVIDER_MODELS[provider].label}</p>
                  <p style={{ fontSize: 11, color: "#888" }}>{PROVIDER_MODELS[provider].models.length + " model tersedia"}</p>
                </div>
                {config.provider === provider && <CheckCircle2 size={18} className="text-[#ff742f] shrink-0" />}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label style={{ fontSize: 12, fontWeight: 700, color: "#555" }}>Model</label>
          <div className="flex flex-col gap-1.5">
            {providerInfo.models.map((m) => (
              <button key={m.id} onClick={() => { setConfig({ ...config, model: m.id }); setSaved(false); }}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-left"
                style={{ borderColor: config.model === m.id ? "#ff742f" : "#e5e5e5", background: config.model === m.id ? "#fff8f4" : "white" }}>
                <span style={{ fontSize: 13, color: "#333", fontWeight: config.model === m.id ? 700 : 400 }}>{m.label}</span>
                {config.model === m.id && <CheckCircle2 size={16} className="text-[#ff742f] shrink-0" />}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label style={{ fontSize: 12, fontWeight: 700, color: "#555" }}>API Key</label>
            <a href={keyUrl} target="_blank" rel="noreferrer"
              style={{ fontSize: 11, color: "#ff742f", fontWeight: 600, textDecoration: "none" }}>
              Dapatkan key
            </a>
          </div>
          <div className="flex gap-2 items-center rounded-xl border border-gray-300 px-3 py-2.5">
            <Key size={14} className="text-gray-500 shrink-0" />
            <input
              type={showKey ? "text" : "password"}
              value={config.apiKey}
              onChange={(e) => { setConfig({ ...config, apiKey: e.target.value }); setSaved(false); }}
              placeholder={"Paste " + providerInfo.label + " API key..."}
              className="flex-1 bg-transparent focus:outline-none text-gray-800 placeholder:text-gray-400"
              style={{ fontSize: 13 }}
            />
            <button onClick={() => setShowKey(!showKey)} className="shrink-0 text-gray-500 hover:text-gray-700">
              {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {config.apiKey ? (
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={12} className="text-green-500" />
              <span style={{ fontSize: 11, color: "#16a34a" }}>API key aktif</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <AlertCircle size={12} className="text-amber-500" />
              <span style={{ fontSize: 11, color: "#92400e" }}>Tanpa API key artikel tidak akan di-rewrite</span>
            </div>
          )}
        </div>

        {/* Custom Prompt */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setShowPrompt(!showPrompt)}
            className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-neutral-200 hover:bg-neutral-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Bot size={15} className="text-[#ff742f]" />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#333" }}>Kustomisasi Prompt AI</span>
            </div>
            <ChevronRight size={15} className={`text-gray-400 transition-transform ${showPrompt ? "rotate-90" : ""}`} />
          </button>

          {showPrompt && (
            <div className="flex flex-col gap-2 border border-neutral-200 rounded-xl p-3">
              <p style={{ fontSize: 11, color: "#888" }}>
                Prompt ini menentukan cara AI menulis ulang artikel. Harus menghasilkan JSON dengan field: title, summary, content (array), category.
              </p>
              <textarea
                value={customPrompt}
                onChange={e => { setCustomPrompt(e.target.value); setSaved(false); }}
                rows={12}
                className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#ff742f] font-mono resize-y"
                style={{ fontSize: 11, color: "#333", lineHeight: "1.6" }}
              />
              <button
                onClick={() => { setCustomPrompt(DEFAULT_PROMPT); setSaved(false); }}
                className="self-start px-3 py-1.5 rounded-lg border border-neutral-200 text-neutral-500 hover:border-red-300 hover:text-red-500 transition-colors"
                style={{ fontSize: 11, fontWeight: 600 }}
              >
                Reset ke prompt default
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button onClick={handleSave}
            className="flex-1 py-3 rounded-xl font-bold transition-all active:opacity-80"
            style={{ background: saved ? "#16a34a" : "linear-gradient(135deg, #ff742f 0%, #ff9a5c 100%)", color: "white", fontSize: 14 }}>
            {saved ? "✓ Tersimpan!" : "Simpan Konfigurasi AI"}
          </button>
          <button onClick={handleResetConfig}
            className="px-4 py-3 rounded-xl border border-neutral-200 text-neutral-500 hover:border-red-300 hover:text-red-500 transition-colors font-bold"
            style={{ fontSize: 13 }}
            title="Reset semua konfigurasi AI">
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Settings Page ────────────────────────────────────────────────────────

export function SettingsPage() {
  const navigate = useNavigate();
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [refreshed, setRefreshed] = useState(false);

  function loadSources() { setSources(getSources()); }
  useEffect(() => { loadSources(); }, []);

  function handleToggle(id: string) {
    const src = sources.find((s) => s.id === id);
    if (!src) return;
    toggleSource(id, !src.enabled);
    clearAllSourceCache();
    loadSources();
  }

  function handleRemove(id: string) {
    removeSource(id);
    clearAllSourceCache(); clearRewriteCache();
    loadSources();
  }

  function handleRefreshAll() {
    clearAllSourceCache(); clearRewriteCache();
    setRefreshed(true);
    setTimeout(() => setRefreshed(false), 2000);
  }

  const enabledCount = sources.filter((s) => s.enabled).length;

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#f8f5f1" }}>
      <div className="sticky top-0 z-30 border-b" style={{ background: "rgba(252,249,245,0.97)", backdropFilter: "blur(16px)", borderColor: "#ede8e2" }}>
        <div className="px-4 pt-4 pb-4">
          <div className="mb-3">
            <p style={{ fontSize: 11, fontWeight: 700, color: "#ff742f", letterSpacing: "0.08em" }}>☕ PENGATURAN</p>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: "#1a1a1a", lineHeight: 1.1, letterSpacing: "-0.01em" }}>Daftar Barista</h1>
          </div>
          <p className="text-neutral-500" style={{ fontSize: 12 }}>
            {enabledCount} sumber aktif
          </p>
        </div>
      </div>

      <div className="flex-1 px-4 pt-5 pb-32 max-w-4xl mx-auto w-full flex flex-col gap-6">
        <AIConfigSection />

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 style={{ fontSize: 15, fontWeight: 800, color: "#1a1a1a" }}>Sumber Berita</h2>
            <div className="flex gap-2">
              <button onClick={() => setShowAdd(true)}
                className="flex items-center gap-1.5 bg-[#ff742f] text-white rounded-full px-3 py-1.5 active:opacity-80 hover:opacity-90 transition-opacity"
                style={{ fontSize: 12, fontWeight: 700 }}>
                <Plus size={14} />Tambah Sumber
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-2 bg-white rounded-xl p-3 border border-gray-200">
            {sources.length === 0 ? (
              <p className="text-gray-500 text-center py-6 text-sm">Belum ada sumber berita</p>
            ) : (
              sources.map((source) => (
                <SourceCard key={source.id} source={source} onToggle={() => handleToggle(source.id)} onRemove={() => handleRemove(source.id)} />
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <h2 style={{ fontSize: 15, fontWeight: 800, color: "#1a1a1a", marginBottom: 8 }}>Cache</h2>
          <button onClick={handleRefreshAll} className="flex items-center justify-between py-3 w-full active:opacity-70 hover:bg-gray-50 px-2 rounded-lg transition-colors">
            <div className="flex items-center gap-3">
              <RefreshCw size={18} className={refreshed ? "text-[#ff742f] animate-spin" : "text-[#ff742f]"} />
              <div className="text-left">
                <p style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{refreshed ? "Cache dihapus!" : "Hapus semua cache"}</p>
                <p className="text-gray-500" style={{ fontSize: 11 }}>Paksa reload dan rewrite ulang semua artikel</p>
              </div>
            </div>
            {!refreshed && <ChevronRight size={16} className="text-gray-400" />}
          </button>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <h2 style={{ fontSize: 15, fontWeight: 800, color: "#1a1a1a", marginBottom: 8 }}>Tools</h2>
          <button onClick={() => navigate("/fetchrss")} className="flex items-center justify-between py-3 w-full active:opacity-70 hover:bg-gray-50 px-2 rounded-lg transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#ff742f20" }}>
                <Rss size={18} className="text-[#ff742f]" />
              </div>
              <div className="text-left">
                <p style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>FetchRSS Generator</p>
                <p className="text-gray-500" style={{ fontSize: 11 }}>Buat feed RSS dari website apapun dengan FetchRSS</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </button>
        </div>
      </div>

      {showAdd && <AddSourceModal onClose={() => setShowAdd(false)} onAdded={loadSources} />}
    </div>
  );
}