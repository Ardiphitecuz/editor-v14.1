# Integrasi The Newsroom RSS

Aplikasi ini menggunakan engine RSS dari **[the-newsroom-rss](https://github.com/royalgarter/the-newsroom-rss)** sebagai backend feeds utama.

## Struktur Folder

```
project/
├── backend/
│   └── newsroom-engine.js    ← Port penuh the-newsroom-rss (Deno → Node.js)
├── src/
│   └── app/
│       └── services/
│           ├── newsroomFetcher.ts   ← Frontend service: panggil /api/feeds
│           ├── newsFetcher.ts       ← Orkestrator (diupdate)
│           ├── rssFetcher.ts        ← Fallback RSS parser
│           └── websiteFetcher.ts    ← Website scraper
├── server.js                 ← Express server + endpoint /api/feeds
└── ...
```

## Cara Kerja

### Backend

`server.js` sekarang menyertakan endpoint baru:

```
GET  /api/feeds?u=<url1>,<url2>&l=<limit>&pioneer=<bool>
POST /api/feeds  { keys: [{url, order}], limit, pioneer }
```

Endpoint ini dijalankan oleh `backend/newsroom-engine.js` yang merupakan port lengkap dari:
- `the-newsroom-rss/backend/src/rss.ts` — parser RSS + normalisasi item
- `the-newsroom-rss/backend/src/handlers.ts` — handler HTTP + caching

**Yang diport secara utuh:**
- `parseRSS()` — fetch + parse RSS/Atom feed dengan in-memory cache
- `processRssItem()` — normalisasi item: gambar, Google News decode, og:image, ldjson
- `fetchRSSLinks()` — orchestrator paralel semua URL
- In-memory CACHE dengan TTL (identik dengan cache.ts asli)

**Perbedaan teknis (Deno → Node.js):**
- `deno.land/x/rss` → `rss-parser` (npm)
- Native `fetch` → `axios` (untuk SSL fallback)
- `Deno.env` → `process.env`

### Frontend

`newsFetcher.ts` sekarang menggunakan `newsroomFetcher.ts` sebagai fetcher utama untuk semua sumber RSS:

```
useNews() 
  → fetchAllSourcesCached()
    → fetchAllSources()
      → fetchFromNewsroomEngine()  ← POST /api/feeds (newsroom engine)
      → fetchFromWebsite()         ← untuk sumber non-RSS (seperti biasa)
```

## Konfigurasi Sumber RSS

Tambah sumber di **Pengaturan → Sumber** atau edit `sourceManager.ts`:

```typescript
{
  id: "kompas",
  name: "Kompas",
  url: "https://kompas.com",
  feedUrl: "https://rss.kompas.com/...",  // ← wajib ada feedUrl
  type: "rss",
  enabled: true,
  ...
}
```

## Menjalankan

```bash
npm run dev
# atau
node server.js  # backend saja
vite            # frontend saja
```

Server berjalan di `http://localhost:3000`, Vite di `http://localhost:5173`.
