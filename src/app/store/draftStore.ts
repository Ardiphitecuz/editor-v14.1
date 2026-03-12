// ─── Draft Store ──────────────────────────────────────────────────────────────
// Menyimpan draft artikel AI + template post ke localStorage
// ─────────────────────────────────────────────────────────────────────────────

export interface DraftTemplate {
  /** Data canvas yang sudah di-export (dataURL PNG) — null jika belum dibuat */
  imageDataUrl: string | null;
  template: "post" | "video";
  label: string;
  titleHtml: string;
  source: string;
  articleSource?: string;
  bgSrc?: string;
  bgMode?: string;
}

export interface Draft {
  id: string;
  /** Judul artikel asli dari RSS */
  articleTitle: string;
  /** Judul yang sudah ditulis ulang AI */
  aiTitle: string;
  /** Paragraf isi artikel AI */
  aiContent: string[];
  /** Sumber artikel asli */
  source: string;
  /** URL gambar dari artikel */
  imageUrl: string;
  /** Template post yang disimpan — null jika hanya simpan ke draft tanpa buat post */
  template: DraftTemplate | null;
  createdAt: number;
  updatedAt: number;
}

type Listener = () => void;

const DRAFT_KEY = "otaku_drafts_v1";

function load(): Draft[] {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Draft[];
  } catch { return []; }
}

function persist(drafts: Draft[]) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
  } catch { /* kuota penuh */ }
}

let _drafts: Draft[] = load();
const _listeners = new Set<Listener>();

function notify() { _listeners.forEach(l => l()); }

export const draftStore = {
  getAll(): Draft[] { return _drafts; },

  get(id: string): Draft | undefined { return _drafts.find(d => d.id === id); },

  /** Buat draft baru, kembalikan id */
  create(data: Omit<Draft, "id" | "createdAt" | "updatedAt">): string {
    const id = "draft_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
    const draft: Draft = { ...data, id, createdAt: Date.now(), updatedAt: Date.now() };
    _drafts = [draft, ..._drafts];
    persist(_drafts);
    notify();
    return id;
  },

  /** Update template (setelah user edit di editor lalu simpan) */
  updateTemplate(id: string, template: DraftTemplate) {
    _drafts = _drafts.map(d =>
      d.id === id ? { ...d, template, updatedAt: Date.now() } : d
    );
    persist(_drafts);
    notify();
  },

  delete(id: string) {
    _drafts = _drafts.filter(d => d.id !== id);
    persist(_drafts);
    notify();
  },

  subscribe(listener: Listener) {
    _listeners.add(listener);
    return () => _listeners.delete(listener);
  },
};
