import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft, Rss, Copy, Check, AlertCircle, Loader2, Plus, Trash2,
  MousePointer2, Monitor, Smartphone, X, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

type Step = "create" | "manage";

interface FetchRSSFeed {
  id: string;
  title: string;
  rss_url: string;
  src_url: string;
}

type SelectorField = "news_selector" | "title_selector" | "content_selector" | "pic_selector" | "date_selector" | "link_selector";

interface SelectorState {
  news_selector: string;
  title_selector: string;
  content_selector: string;
  pic_selector: string;
  date_selector: string;
  link_selector: string;
}

const FIELD_LABELS: Record<SelectorField, { label: string; hint: string; required: boolean }> = {
  news_selector: { label: "Wadah Artikel", hint: "Container tiap artikel/berita", required: true },
  title_selector: { label: "Judul", hint: "Elemen judul artikel", required: true },
  content_selector: { label: "Konten", hint: "Ringkasan atau isi artikel", required: true },
  pic_selector: { label: "Gambar", hint: "Elemen img atau thumbnail", required: false },
  link_selector: { label: "Link", hint: "Elemen <a> untuk URL artikel", required: false },
  date_selector: { label: "Tanggal", hint: "Elemen tanggal publikasi", required: false },
};

const FIELD_ORDER: SelectorField[] = [
  "news_selector", "title_selector", "content_selector",
  "pic_selector", "link_selector", "date_selector",
];

const PROXIES = [
  "https://corsproxy.io/?",
  "https://api.allorigins.win/raw?url=",
  "https://api.codetabs.com/v1/proxy?quest=",
];

async function fetchHtml(url: string): Promise<string> {
  for (const proxy of PROXIES) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch(proxy + encodeURIComponent(url), { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) continue;
      const text = await res.text();
      if (text.length > 500) return text;
    } catch { /* try next */ }
  }
  throw new Error("Semua proxy gagal memuat halaman ini.");
}

// Inject picker script into raw HTML string, then set as srcdoc
function injectPickerScript(html: string, baseUrl: string): string {
  const base = `<base href="${baseUrl}" target="_blank">`;

  const script = `
<style>
  .__ph { outline: 2px dashed #ff742f !important; outline-offset: 2px !important; background: rgba(255,116,47,0.07) !important; cursor: crosshair !important; }
</style>
<script>
(function(){
  // Fix all relative links/images to absolute
  document.querySelectorAll('a[href]').forEach(function(a){
    try { a.href = new URL(a.getAttribute('href'), '${baseUrl}').href; } catch(e){}
    a.target = '_blank';
  });
  document.querySelectorAll('img[src]').forEach(function(img){
    try { img.src = new URL(img.getAttribute('src'), '${baseUrl}').href; } catch(e){}
  });

  var hovered = null;
  document.addEventListener('mouseover', function(e){
    if(hovered) hovered.classList.remove('__ph');
    hovered = e.target;
    if(hovered && hovered.tagName) hovered.classList.add('__ph');
  }, true);

  document.addEventListener('click', function(e){
    e.preventDefault(); e.stopPropagation();
    var el = e.target;
    if(!el || !el.tagName) return;

    function buildSel(el){
      var parts = []; var cur = el;
      while(cur && cur.tagName && cur.tagName.toLowerCase() !== 'body'){
        var sel = cur.tagName.toLowerCase();
        var cls = Array.from(cur.classList)
          .filter(function(c){ return c.length > 1 && !/^\\d/.test(c) && !/^[a-z]{1,2}$/.test(c); })
          .slice(0,2);
        if(cls.length) sel += '.' + cls.join('.');
        if(cur.id && !/^\\d/.test(cur.id)){ parts.unshift('#'+cur.id); break; }
        var parent = cur.parentElement;
        if(parent){
          var sibs = Array.from(parent.children).filter(function(s){ return s.tagName===cur.tagName; });
          if(sibs.length>1){ var idx=sibs.indexOf(cur)+1; if(idx>1) sel+=':nth-child('+idx+')'; }
        }
        parts.unshift(sel); cur = cur.parentElement;
        if(parts.length >= 4) break;
      }
      return parts.join(' > ');
    }

    var selector = buildSel(el);
    window.parent.postMessage({ type: 'SELECTOR_PICKED', selector: selector }, '*');
  }, true);
})();
<\/script>`;

  // Insert before </body> or append
  if (html.includes('</body>')) {
    return html.replace('</body>', script + '</body>').replace('<head>', '<head>' + base);
  }
  return base + html + script;
}

interface SelectorPickerProps {
  url: string;
  activeField: SelectorField;
  onSelect: (field: SelectorField, selector: string) => void;
  onClose: () => void;
  selectors: SelectorState;
}

function SelectorPickerModal({ url, activeField, onSelect, onClose, selectors }: SelectorPickerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");
  const [currentField, setCurrentField] = useState<SelectorField>(activeField);
  const [localSelectors, setLocalSelectors] = useState<SelectorState>({ ...selectors });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPage = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const html = await fetchHtml(url);
      const injected = injectPickerScript(html, url);
      if (iframeRef.current) {
        iframeRef.current.srcdoc = injected;
      }
    } catch (e: any) {
      setLoadError(e.message || "Gagal memuat halaman.");
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => { loadPage(); }, [loadPage]);

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === "SELECTOR_PICKED") {
        const sel = e.data.selector as string;
        setLocalSelectors(prev => ({ ...prev, [currentField]: sel }));
        onSelect(currentField, sel);
        toast.success(`"${FIELD_LABELS[currentField].label}" → ${sel}`);

        // Auto-advance to next required empty field
        const idx = FIELD_ORDER.indexOf(currentField);
        const next = FIELD_ORDER.slice(idx + 1).find(
          f => FIELD_LABELS[f].required && !localSelectors[f]
        );
        if (next) setCurrentField(next);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [currentField, onSelect, localSelectors]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: "#0f0f0f" }}>
      {/* Toolbar */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-white/10" style={{ background: "#1a1a1a" }}>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10">
          <X size={16} className="text-white/70" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-white/50 truncate" style={{ fontSize: 11 }}>{url}</p>
        </div>
        {/* View mode */}
        <div className="flex gap-1 rounded-lg p-1" style={{ background: "#2a2a2a" }}>
          <button
            onClick={() => setViewMode("desktop")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all"
            style={{ background: viewMode === "desktop" ? "#ff742f" : "transparent", color: viewMode === "desktop" ? "white" : "#888" }}
          >
            <Monitor size={13} />
            <span style={{ fontSize: 11, fontWeight: 700 }}>Desktop</span>
          </button>
          <button
            onClick={() => setViewMode("mobile")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all"
            style={{ background: viewMode === "mobile" ? "#ff742f" : "transparent", color: viewMode === "mobile" ? "white" : "#888" }}
          >
            <Smartphone size={13} />
            <span style={{ fontSize: 11, fontWeight: 700 }}>Mobile</span>
          </button>
        </div>
        <button onClick={loadPage} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white/50 hover:text-white transition-colors" style={{ fontSize: 11 }}>
          <RefreshCw size={13} /> Muat ulang
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left panel */}
        <div className="w-64 shrink-0 flex flex-col border-r border-white/10 overflow-y-auto" style={{ background: "#1a1a1a" }}>
          <div className="px-4 py-3 border-b border-white/10">
            <p style={{ fontSize: 12, fontWeight: 700, color: "#ff742f" }}>
              <MousePointer2 size={12} className="inline mr-1" />
              Klik elemen di halaman
            </p>
            <p style={{ fontSize: 10, color: "#555", marginTop: 2 }}>Pilih field aktif lalu klik elemen</p>
          </div>
          <div className="flex flex-col gap-1 p-3">
            {FIELD_ORDER.map((field) => {
              const { label, hint, required } = FIELD_LABELS[field];
              const val = localSelectors[field];
              const active = currentField === field;
              return (
                <button
                  key={field}
                  onClick={() => setCurrentField(field)}
                  className="flex flex-col items-start gap-1 px-3 py-2.5 rounded-xl transition-all text-left"
                  style={{ background: active ? "#ff742f20" : "transparent", border: `1px solid ${active ? "#ff742f60" : "transparent"}` }}
                >
                  <div className="flex items-center gap-2 w-full">
                    <span style={{ fontSize: 11, fontWeight: 700, color: active ? "#ff742f" : "#ccc" }}>
                      {label}{required && <span style={{ color: "#ff742f", marginLeft: 2 }}>*</span>}
                    </span>
                    {val && <span className="ml-auto w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ background: "#22c55e20" }}><Check size={10} style={{ color: "#22c55e" }} /></span>}
                  </div>
                  {val
                    ? <span className="font-mono truncate w-full" style={{ fontSize: 9, color: "#22c55e", maxWidth: 180 }}>{val}</span>
                    : <span style={{ fontSize: 10, color: "#555" }}>{hint}</span>
                  }
                </button>
              );
            })}
          </div>
          <div className="mt-auto p-3 border-t border-white/10">
            <button onClick={onClose} className="w-full py-2.5 rounded-xl font-bold text-white" style={{ background: "linear-gradient(135deg, #ff742f, #ff9a5c)", fontSize: 13 }}>
              Selesai
            </button>
          </div>
        </div>

        {/* Right panel: iframe with srcdoc */}
        <div className="flex-1 overflow-auto flex items-start justify-center" style={{ background: "#0f0f0f", padding: viewMode === "mobile" ? "20px" : "0" }}>
          {loadError ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8 py-20">
              <AlertCircle size={32} className="text-red-400" />
              <p style={{ fontSize: 13, color: "#ccc" }}>{loadError}</p>
              <p style={{ fontSize: 11, color: "#666" }}>Masukkan CSS selector secara manual di form.</p>
              <div className="flex gap-2 mt-2">
                <button onClick={loadPage} className="px-4 py-2 rounded-xl border border-white/20 text-white/70 font-bold" style={{ fontSize: 13 }}>
                  <RefreshCw size={13} className="inline mr-1" /> Coba lagi
                </button>
                <button onClick={onClose} className="px-4 py-2 rounded-xl text-white font-bold" style={{ background: "#ff742f", fontSize: 13 }}>
                  Kembali ke Form
                </button>
              </div>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Loader2 size={24} className="animate-spin text-[#ff742f]" />
              <p style={{ fontSize: 12, color: "#666" }}>Memuat halaman via proxy...</p>
            </div>
          ) : (
            <div style={{ width: viewMode === "mobile" ? "375px" : "100%", maxWidth: "100%", minHeight: "calc(100vh - 56px)", position: "relative" }}>
              <iframe
                ref={iframeRef}
                style={{ width: "100%", minHeight: "calc(100vh - 56px)", border: "none", display: "block" }}
                sandbox="allow-scripts allow-same-origin"
                title="Selector Picker"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function FetchRSSPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("create");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  const [createUrl, setCreateUrl] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [selectors, setSelectors] = useState<SelectorState>({
    news_selector: "", title_selector: "", content_selector: "",
    pic_selector: "", date_selector: "", link_selector: "",
  });
  const [createdFeed, setCreatedFeed] = useState<FetchRSSFeed | null>(null);
  const [copied, setCopied] = useState(false);

  const [showPicker, setShowPicker] = useState(false);
  const [pickerField, setPickerField] = useState<SelectorField>("news_selector");

  const [feeds, setFeeds] = useState<FetchRSSFeed[]>([]);
  const [feedsLoading, setFeedsLoading] = useState(false);
  const [feedsError, setFeedsError] = useState<string | null>(null);

  function openPicker(field: SelectorField) {
    if (!createUrl.trim()) { setCreateError("Masukkan URL website terlebih dahulu"); return; }
    setPickerField(field);
    setShowPicker(true);
  }

  function handleSelectorPick(field: SelectorField, selector: string) {
    setSelectors(prev => ({ ...prev, [field]: selector }));
  }

  async function handleCreateFeed() {
    if (!apiKey.trim()) { setCreateError("API key diperlukan"); return; }
    if (!createUrl.trim()) { setCreateError("URL diperlukan"); return; }
    if (!selectors.news_selector.trim() || !selectors.title_selector.trim() || !selectors.content_selector.trim()) {
      setCreateError("CSS selectors (Wadah, Judul, Konten) diperlukan"); return;
    }
    setCreateLoading(true); setCreateError(null);
    try {
      const formData = new FormData();
      formData.append("url", createUrl.trim());
      formData.append("news_selector", selectors.news_selector.trim());
      formData.append("title_selector", selectors.title_selector.trim());
      formData.append("content_selector", selectors.content_selector.trim());
      if (selectors.pic_selector.trim()) formData.append("pic_selector", selectors.pic_selector.trim());
      if (selectors.date_selector.trim()) formData.append("date_selector", selectors.date_selector.trim());
      if (selectors.link_selector.trim()) formData.append("link_selector", selectors.link_selector.trim());
      const response = await fetch("https://fetchrss.com/api/v2/feeds", {
        method: "POST", headers: { "API-KEY": apiKey.trim() }, body: formData,
      });
      const data = await response.json();
      if (data.success && data.feed) { setCreatedFeed(data.feed); toast.success("Feed berhasil dibuat!"); }
      else setCreateError(data.error?.message || "Gagal membuat feed");
    } catch (e: any) { setCreateError(e.message || "Error membuat feed"); }
    finally { setCreateLoading(false); }
  }

  async function handleFetchFeeds() {
    if (!apiKey.trim()) { setFeedsError("API key diperlukan"); return; }
    setFeedsLoading(true); setFeedsError(null);
    try {
      const response = await fetch("https://fetchrss.com/api/v2/feeds", { headers: { "API-KEY": apiKey.trim() } });
      const data = await response.json();
      if (data.success && Array.isArray(data.feeds)) setFeeds(data.feeds);
      else setFeedsError(data.error?.message || "Gagal mengambil feeds");
    } catch (e: any) { setFeedsError(e.message || "Error mengambil feeds"); }
    finally { setFeedsLoading(false); }
  }

  async function handleDeleteFeed(feedId: string) {
    if (!apiKey.trim() || !confirm("Hapus feed ini?")) return;
    try {
      const response = await fetch(`https://fetchrss.com/api/v2/feeds/${feedId}`, {
        method: "DELETE", headers: { "API-KEY": apiKey.trim() },
      });
      const data = await response.json();
      if (data.success) { setFeeds(feeds.filter(f => f.id !== feedId)); toast.success("Feed dihapus!"); }
      else setFeedsError(data.error?.message || "Gagal menghapus feed");
    } catch (e: any) { setFeedsError(e.message || "Error menghapus feed"); }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const allRequiredFilled = selectors.news_selector && selectors.title_selector && selectors.content_selector;

  return (
    <>
      <div className="flex flex-col min-h-screen bg-white">
        <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 pt-4 pb-3">
          <div className="flex items-center gap-3 max-w-3xl mx-auto">
            <button onClick={() => navigate("/pengaturan")} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 active:opacity-70">
              <ArrowLeft size={18} className="text-gray-600" />
            </button>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: "#1a1a1a" }}>FetchRSS Generator</h1>
              <p className="text-gray-500" style={{ fontSize: 12 }}>Buat RSS feed dari website apapun</p>
            </div>
          </div>
        </div>

        <div className="flex-1 px-4 py-6 max-w-3xl mx-auto w-full">
          {/* API Key */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
            <label style={{ fontSize: 13, fontWeight: 700, color: "#333" }}>FetchRSS API Key</label>
            <div className="flex gap-2 items-center rounded-xl border border-gray-300 px-3 py-2.5 mt-2">
              <input
                type={showKey ? "text" : "password"} value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Dapatkan dari https://fetchrss.com/account/api"
                className="flex-1 bg-transparent focus:outline-none text-gray-800 placeholder:text-gray-400"
                style={{ fontSize: 13 }}
              />
              <button onClick={() => setShowKey(!showKey)} className="shrink-0 text-gray-500 hover:text-gray-700">
                {showKey ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
            <p style={{ fontSize: 11, color: "#888", marginTop: 6 }}>
              Dapatkan API key gratis di <a href="https://fetchrss.com/account/api" target="_blank" rel="noreferrer" style={{ color: "#ff742f" }}>account settings</a>
            </p>
          </div>

          {/* Toggle */}
          <div className="flex gap-2 mb-6">
            <button onClick={() => setStep("create")} className="flex-1 py-2.5 rounded-xl font-bold transition-all"
              style={{ background: step === "create" ? "#ff742f" : "#f0ede9", color: step === "create" ? "white" : "#555", fontSize: 13 }}>
              Buat Feed Baru
            </button>
            <button onClick={() => { setStep("manage"); if (feeds.length === 0) handleFetchFeeds(); }}
              className="flex-1 py-2.5 rounded-xl font-bold transition-all"
              style={{ background: step === "manage" ? "#ff742f" : "#f0ede9", color: step === "manage" ? "white" : "#555", fontSize: 13 }}>
              Kelola Feed
            </button>
          </div>

          {/* CREATE */}
          {step === "create" && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <label style={{ fontSize: 13, fontWeight: 700, color: "#333" }}>URL Website</label>
                <div className="flex gap-2 mt-2">
                  <input
                    type="url" value={createUrl}
                    onChange={(e) => setCreateUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#ff742f]"
                    style={{ fontSize: 13 }}
                  />
                  <button
                    onClick={() => openPicker("news_selector")} disabled={!createUrl.trim()}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white font-bold disabled:opacity-40 shrink-0 transition-all hover:opacity-90 active:scale-95"
                    style={{ background: "linear-gradient(135deg, #ff742f, #ff9a5c)", fontSize: 13 }}
                  >
                    <MousePointer2 size={15} />
                    Buka &amp; Pilih
                  </button>
                </div>
              </div>

              <div className="rounded-xl p-3 border flex items-start gap-2.5" style={{ background: "#fff8f4", borderColor: "#ff742f30" }}>
                <MousePointer2 size={15} className="text-[#ff742f] mt-0.5 shrink-0" />
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#ff742f" }}>Visual picker — tanpa DevTools!</p>
                  <p style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                    Klik "Buka &amp; Pilih" lalu klik elemen di halaman. Halaman dimuat via proxy sehingga bisa diklik bebas.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {FIELD_ORDER.map((field) => {
                  const { label, hint, required } = FIELD_LABELS[field];
                  const val = selectors[field];
                  return (
                    <div key={field} className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <label style={{ fontSize: 12, fontWeight: 700, color: "#333" }}>
                          {label}{required && <span style={{ color: "#ff742f" }}> *</span>}
                        </label>
                        <button
                          onClick={() => openPicker(field)} disabled={!createUrl.trim()}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg disabled:opacity-30 transition-all hover:opacity-80"
                          style={{ background: "#ff742f15", fontSize: 10, fontWeight: 700, color: "#ff742f" }}
                        >
                          <MousePointer2 size={10} /> Klik
                        </button>
                      </div>
                      <div className="flex gap-1.5">
                        <input
                          type="text" value={val}
                          onChange={(e) => setSelectors(prev => ({ ...prev, [field]: e.target.value }))}
                          placeholder={hint}
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-[#ff742f]"
                          style={{ fontSize: 12, fontFamily: "monospace" }}
                        />
                        {val && (
                          <button onClick={() => setSelectors(prev => ({ ...prev, [field]: "" }))} className="p-2 rounded-lg hover:bg-red-50 text-red-400">
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {createError && (
                <div className="flex gap-2 items-start p-3 rounded-xl bg-red-50 border border-red-200">
                  <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                  <p style={{ fontSize: 12, color: "#dc2626" }}>{createError}</p>
                </div>
              )}

              <button
                onClick={handleCreateFeed} disabled={createLoading || !allRequiredFilled}
                className="w-full py-3 rounded-xl text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, #ff742f, #ff9a5c)", fontSize: 14 }}
              >
                {createLoading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {createLoading ? "Membuat Feed..." : "Buat Feed RSS"}
              </button>

              {createdFeed && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#166534", marginBottom: 8 }}>✓ Feed Berhasil Dibuat!</p>
                  <div className="space-y-2">
                    <p style={{ fontSize: 11, color: "#555" }}>Judul: <strong>{createdFeed.title}</strong></p>
                    <div>
                      <p style={{ fontSize: 11, color: "#555", marginBottom: 4 }}>URL RSS:</p>
                      <div className="flex gap-2">
                        <input type="text" value={createdFeed.rss_url} readOnly className="flex-1 border border-green-300 rounded-lg px-2 py-1" style={{ fontSize: 11 }} />
                        <button onClick={() => copyToClipboard(createdFeed.rss_url)} className="px-3 py-1 rounded-lg bg-green-200 hover:bg-green-300 text-green-900">
                          {copied ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MANAGE */}
          {step === "manage" && (
            <div className="space-y-4">
              <button onClick={handleFetchFeeds} disabled={feedsLoading || !apiKey.trim()}
                className="w-full py-2.5 rounded-xl text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: "#ff742f", fontSize: 13 }}>
                {feedsLoading ? <Loader2 size={14} className="animate-spin" /> : "Muat Feed"}
              </button>
              {feedsError && (
                <div className="flex gap-2 items-start p-3 rounded-xl bg-red-50 border border-red-200">
                  <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                  <p style={{ fontSize: 12, color: "#dc2626" }}>{feedsError}</p>
                </div>
              )}
              {feeds.length === 0 ? (
                <div className="text-center py-12">
                  <Rss size={32} className="text-gray-300 mx-auto mb-3" />
                  <p style={{ fontSize: 14, color: "#999" }}>Belum ada feed</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {feeds.map((feed) => (
                    <div key={feed.id} className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a" }} className="truncate">{feed.title}</p>
                          <p style={{ fontSize: 11, color: "#888", marginTop: 4 }} className="truncate">RSS: {feed.rss_url}</p>
                          <p style={{ fontSize: 11, color: "#888", marginTop: 2 }} className="truncate">Source: {feed.src_url}</p>
                        </div>
                        <button onClick={() => handleDeleteFeed(feed.id)} className="shrink-0 p-2 rounded-lg hover:bg-red-50 text-red-500">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showPicker && createUrl && (
        <SelectorPickerModal
          url={createUrl}
          activeField={pickerField}
          selectors={selectors}
          onSelect={handleSelectorPick}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  );
}