import { useState, useEffect } from "react";
import {
  Plus, Trash2, ToggleLeft, ToggleRight,
  Rss, Loader2, CheckCircle2, XCircle, AlertCircle,
  Search,
} from "lucide-react";
import {
  getSources, addSource, removeSource, toggleSource,
  detectSourceType, buildGoogleNewsUrl, isGoogleNewsUrl, type NewsSource,
} from "../services/sourceManager";
import { clearAllSourceCache } from "../services/newsFetcher";
import { clearRewriteCache } from "../services/rewriter";
import { MascotEmpty, MascotActionButton } from "./MascotEmpty";

const LANG_LABELS: Record<string, string> = {
  ja: "Jepang", en: "Inggris", id: "Indonesia",
  ko: "Korea", zh: "Mandarin", es: "Spanyol", pt: "Portugis",
};

// ── Source Card ───────────────────────────────────────────────────────────────

function SourceCard({ source, onToggle, onRemove }: {
  source: NewsSource; onToggle: () => void; onRemove: () => void;
}) {
  const isDefault = source.id === "yaraon";

  const getAvatarBg = (name: string) => {
    const colors = ["#ff742f", "#4285f4", "#34a853", "#fbbc04", "#ea4335", "#9c27b0"];
    return colors[name.charCodeAt(0) % colors.length];
  };

  const getTimeAgo = (timestamp?: number) => {
    if (!timestamp) return null;
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    if (mins < 1) return { text: "Baru", color: "#10b981", bg: "#d1fae5" };
    if (mins < 60) return { text: `${mins}m`, color: mins < 30 ? "#10b981" : "#eab308", bg: mins < 30 ? "#d1fae5" : "#fef3c7" };
    return { text: `${hours}j`, color: hours < 6 ? "#f97316" : "#ef4444", bg: hours < 6 ? "#fed7aa" : "#fee2e2" };
  };

  const timeInfo = getTimeAgo(source.lastFetched ? new Date(source.lastFetched).getTime() : undefined);

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all"
      style={{
        background: "white",
        border: "1px solid #ede8e2",
        opacity: source.enabled ? 1 : 0.5,
      }}
    >
      {/* Avatar */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0"
        style={{ background: getAvatarBg(source.name), fontSize: 15 }}
      >
        {source.name.charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a" }} className="truncate">{source.name}</p>
        <p style={{ fontSize: 11, color: "#b0a89e" }} className="truncate">
          {isGoogleNewsUrl(source.feedUrl ?? source.url) ? "Google News" : (source.feedUrl ?? source.url)}
        </p>
      </div>

      {/* Time badge */}
      {timeInfo && (
        <div className="shrink-0 px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: timeInfo.bg }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: timeInfo.color }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: timeInfo.color }}>{timeInfo.text}</span>
        </div>
      )}

      {/* Toggle */}
      <button onClick={onToggle} className="shrink-0 hover:opacity-80 transition-opacity">
        {source.enabled
          ? <ToggleRight size={26} style={{ color: "#ff742f" }} />
          : <ToggleLeft size={26} style={{ color: "#c0b8b0" }} />}
      </button>

      {/* Remove */}
      {!isDefault && (
        <button onClick={onRemove} className="shrink-0 p-1.5 rounded-lg hover:bg-red-50 transition-colors">
          <Trash2 size={16} style={{ color: "#ef4444" }} />
        </button>
      )}
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
    { code: "ja", country: "JP", label: "Jepang" },
    { code: "ko", country: "KR", label: "Korea" },
    { code: "zh", country: "CN", label: "Mandarin" },
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
    try { hostname = new URL(withProto).hostname; } catch { /* ok */ }
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
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: "rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div
        className="w-full rounded-t-3xl flex flex-col gap-5 overflow-y-auto"
        style={{ background: "white", maxHeight: "88vh", padding: "24px 20px 100px" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "#1a1a1a" }}>Tambah Sumber Berita</h2>
          <button onClick={onClose}><XCircle size={22} style={{ color: "#c0b8b0" }} /></button>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-2">
          <button onClick={() => setMode("url")} className="flex-1 py-2.5 rounded-xl font-bold transition-all"
            style={{ background: mode === "url" ? "#ff742f" : "#f0ede9", color: mode === "url" ? "white" : "#555", fontSize: 13 }}>
            URL / RSS Feed
          </button>
          <button onClick={() => setMode("googlenews")} className="flex-1 py-2.5 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5"
            style={{ background: mode === "googlenews" ? "#4285f4" : "#f0ede9", color: mode === "googlenews" ? "white" : "#555", fontSize: 13 }}>
            <Search size={14} /> Google News
          </button>
        </div>

        {mode === "url" && (
          <>
            <div className="flex flex-col gap-2">
              <label style={{ fontSize: 13, fontWeight: 700, color: "#333" }}>URL Website / RSS Feed</label>
              <div className="flex gap-2">
                <input type="url" value={url}
                  onChange={e => { setUrl(e.target.value); setDetected(null); setDetectError(null); }}
                  placeholder="https://contoh.com/feed"
                  className="flex-1 rounded-xl border px-3 py-2.5 focus:outline-none"
                  style={{ fontSize: 13, borderColor: "#ede8e2" }} />
                <button onClick={handleDetect} disabled={detecting || !url.trim()}
                  className="px-4 py-2.5 rounded-xl text-white font-bold disabled:opacity-50 shrink-0"
                  style={{ background: "#ff742f", fontSize: 13 }}>
                  {detecting ? <Loader2 size={16} className="animate-spin" /> : "Cek"}
                </button>
              </div>
              {detectError && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
                  <AlertCircle size={14} style={{ color: "#ef4444" }} />
                  <p style={{ fontSize: 12, color: "#b91c1c" }}>{detectError}</p>
                </div>
              )}
              {detected && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                  <CheckCircle2 size={14} style={{ color: "#22c55e" }} />
                  <p style={{ fontSize: 12, color: "#166534" }}>
                    {"Terdeteksi: " + (detected.type === "rss" ? "RSS Feed" : "Website") + (detected.name ? " — " + detected.name : "")}
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
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-3 rounded-xl border font-bold" style={{ borderColor: "#ede8e2", fontSize: 14 }}>Batal</button>
              <button onClick={handleAddUrl} disabled={!detected}
                className="flex-1 py-3 rounded-xl text-white font-bold disabled:opacity-50"
                style={{ background: "#ff742f", fontSize: 14 }}>Tambahkan</button>
            </div>
          </>
        )}

        {mode === "googlenews" && (
          <>
            <div className="flex flex-col gap-2">
              <label style={{ fontSize: 13, fontWeight: 700, color: "#333" }}>Topik / Kata Kunci</label>
              <input type="text" value={gnQuery} onChange={e => setGnQuery(e.target.value)}
                placeholder="Contoh: teknologi AI, anime, bola..."
                className="rounded-xl border px-3 py-2.5 focus:outline-none"
                style={{ fontSize: 13, borderColor: "#ede8e2" }} />
            </div>
            <div className="flex flex-col gap-2">
              <label style={{ fontSize: 13, fontWeight: 700, color: "#333" }}>Bahasa & Negara</label>
              <div className="flex flex-col gap-1.5">
                {GN_LANGS.map(l => (
                  <button key={l.code + l.country}
                    onClick={() => { setGnLang(l.code); setGnCountry(l.country); }}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-left"
                    style={{ borderColor: gnLang === l.code && gnCountry === l.country ? "#4285f4" : "#ede8e2", background: gnLang === l.code && gnCountry === l.country ? "#eff6ff" : "white" }}>
                    <span style={{ fontSize: 13, color: "#333" }}>{l.label}</span>
                    {gnLang === l.code && gnCountry === l.country && <CheckCircle2 size={16} style={{ color: "#4285f4" }} />}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-3 rounded-xl border font-bold" style={{ borderColor: "#ede8e2", fontSize: 14 }}>Batal</button>
              <button onClick={handleAddGoogleNews} disabled={!gnQuery.trim()}
                className="flex-1 py-3 rounded-xl text-white font-bold disabled:opacity-50"
                style={{ background: "#4285f4", fontSize: 14 }}>Tambahkan</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Subscriptions Page ───────────────────────────────────────────────────

export function SubscriptionsPage() {
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [activeTab, setActiveTab] = useState<"follow" | "following">("following");

  function loadSources() { setSources(getSources()); }
  useEffect(() => { loadSources(); }, []);

  function handleToggle(id: string) {
    const src = sources.find(s => s.id === id);
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

  const enabledSources = sources.filter(s => s.enabled);
  const allSources = sources;

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#f8f5f1" }}>
      {/* Header */}
      <div className="sticky top-0 z-30 border-b"
        style={{ background: "rgba(252,249,245,0.97)", backdropFilter: "blur(16px)", borderColor: "#ede8e2" }}>
        <div className="px-4 pt-4 pb-3">
          <p style={{ fontSize: 11, fontWeight: 700, color: "#ff742f", letterSpacing: "0.08em" }}>☕ SUMBER BERITA</p>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: "#1a1a1a", lineHeight: 1.1, letterSpacing: "-0.01em" }}>
            Sources
          </h1>
        </div>

        {/* Follow / Following tabs */}
        <div className="flex px-4 pb-3 gap-1">
          <button
            onClick={() => setActiveTab("follow")}
            className="px-4 py-2 rounded-full font-bold transition-all"
            style={{ background: activeTab === "follow" ? "#1a1a1a" : "transparent", color: activeTab === "follow" ? "white" : "#9ca3af", fontSize: 13 }}
          >
            Follow
          </button>
          <button
            onClick={() => setActiveTab("following")}
            className="px-4 py-2 rounded-full font-bold transition-all"
            style={{ background: activeTab === "following" ? "#1a1a1a" : "transparent", color: activeTab === "following" ? "white" : "#9ca3af", fontSize: 13 }}
          >
            Following ({enabledSources.length})
          </button>
        </div>
      </div>

      {/* Source list */}
      <div className="flex-1 px-4 pt-4 pb-28">
        {/* Add button */}
        <button
          onClick={() => setShowAdd(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl mb-4 transition-all active:scale-[0.98]"
          style={{ background: "white", border: "2px dashed #ede8e2" }}
        >
          <Plus size={18} style={{ color: "#ff742f" }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: "#ff742f" }}>Tambah Sumber Baru</span>
        </button>

        {/* List */}
        <div className="flex flex-col gap-2">
          {(activeTab === "following" ? enabledSources : allSources).map(source => (
            <SourceCard
              key={source.id}
              source={source}
              onToggle={() => handleToggle(source.id)}
              onRemove={() => handleRemove(source.id)}
            />
          ))}

          {(activeTab === "following" ? enabledSources : allSources).length === 0 && (
            <MascotEmpty
              expression="subscriptions_empty"
              title={activeTab === "following" ? "Belum ada sumber aktif" : "Belum ada sumber ditambahkan"}
              description={activeTab === "following" ? "Aktifkan minimal satu sumber RSS di tab Semua" : "Tambahkan sumber berita RSS favoritmu"}
              size={140}
            />
          )}
        </div>
      </div>

      {showAdd && <AddSourceModal onClose={() => setShowAdd(false)} onAdded={loadSources} />}
    </div>
  );
}
