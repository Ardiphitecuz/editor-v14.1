// ─── Draft Store ──────────────────────────────────────────────────────────────
// Menyimpan draft artikel AI ke localStorage (metadata ringan)
// imageDataUrl disimpan terpisah di IndexedDB agar tidak overflow kuota localStorage
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
  articleTitle: string;
  aiTitle: string;
  aiContent: string[];
  source: string;
  imageUrl: string;
  template: DraftTemplate | null;
  createdAt: number;
  updatedAt: number;
}

type Listener = () => void;

// ── IndexedDB untuk imageDataUrl ──────────────────────────────────────────────
const IDB_NAME = "otaku_draft_images";
const IDB_STORE = "images";
let _idb: IDBDatabase | null = null;

function openIDB(): Promise<IDBDatabase> {
  if (_idb) return Promise.resolve(_idb);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => { _idb = req.result; resolve(_idb); };
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: string): Promise<void> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet(key: string): Promise<string | null> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── localStorage untuk metadata draft (tanpa imageDataUrl) ────────────────────
const DRAFT_KEY = "otaku_drafts_v2";

type DraftMeta = Omit<Draft, "template"> & {
  template: (Omit<DraftTemplate, "imageDataUrl"> & { hasImage: boolean }) | null;
};

function stripImage(draft: Draft): DraftMeta {
  return {
    ...draft,
    template: draft.template
      ? { ...draft.template, hasImage: !!draft.template.imageDataUrl, imageDataUrl: undefined as any }
      : null,
  };
}

function load(): Draft[] {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return [];
    const metas = JSON.parse(raw) as DraftMeta[];
    // imageDataUrl akan di-load async lewat loadImages()
    return metas.map(m => ({
      ...m,
      template: m.template
        ? { ...m.template, imageDataUrl: null }
        : null,
    }));
  } catch { return []; }
}

function persist(drafts: Draft[]) {
  try {
    const metas = drafts.map(stripImage);
    localStorage.setItem(DRAFT_KEY, JSON.stringify(metas));
  } catch (e) {
    console.warn("[draftStore] localStorage penuh:", e);
  }
}

let _drafts: Draft[] = load();
const _listeners = new Set<Listener>();

function notify() { _listeners.forEach(l => l()); }

// Load semua imageDataUrl dari IDB saat startup
async function loadImages() {
  const updated: Draft[] = [];
  for (const draft of _drafts) {
    if (draft.template) {
      try {
        const img = await idbGet(draft.id);
        updated.push({ ...draft, template: { ...draft.template, imageDataUrl: img } });
      } catch {
        updated.push(draft);
      }
    } else {
      updated.push(draft);
    }
  }
  _drafts = updated;
  notify();
}

// Mulai load images saat modul dimuat
loadImages();

export const draftStore = {
  getAll(): Draft[] { return _drafts; },

  get(id: string): Draft | undefined { return _drafts.find(d => d.id === id); },

  /** Buat draft baru, kembalikan id */
  create(data: Omit<Draft, "id" | "createdAt" | "updatedAt">): string {
    const id = "draft_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
    const draft: Draft = { ...data, id, createdAt: Date.now(), updatedAt: Date.now() };
    _drafts = [draft, ..._drafts];
    persist(_drafts);
    // Simpan imageDataUrl ke IDB jika ada
    if (draft.template?.imageDataUrl) {
      idbSet(id, draft.template.imageDataUrl).catch(e => console.warn("[draftStore] IDB set error:", e));
    }
    notify();
    return id;
  },

  /** Update template (setelah user edit di editor lalu simpan) */
  updateTemplate(id: string, template: DraftTemplate) {
    _drafts = _drafts.map(d =>
      d.id === id ? { ...d, template, updatedAt: Date.now() } : d
    );
    persist(_drafts);
    // Simpan / update imageDataUrl di IDB
    if (template.imageDataUrl) {
      idbSet(id, template.imageDataUrl).catch(e => console.warn("[draftStore] IDB set error:", e));
    }
    notify();
  },

  delete(id: string) {
    _drafts = _drafts.filter(d => d.id !== id);
    persist(_drafts);
    idbDelete(id).catch(() => {});
    notify();
  },

  subscribe(listener: Listener) {
    _listeners.add(listener);
    return () => _listeners.delete(listener);
  },

  /** Paksa reload semua imageDataUrl dari IDB — panggil saat page mount */
  async reloadImages(): Promise<void> {
    await loadImages();
  },
};
