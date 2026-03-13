import { put, head } from '@vercel/blob';

export const config = { maxDuration: 15 };

// Helper function for Vercel Serverless environment
async function readBlobAsJson(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('readBlobError:', err);
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Cek environment BLOB_READ_WRITE_TOKEN
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    // Kembalikan 503 Service Unavailable agar client tahu fitur ini belum aktif
    return res.status(503).json({ error: 'Vercel Blob Token is not configured. Connect project to Blob in Vercel Dashboard.' });
  }

  try {
    // GET: Retrieve Draft
    if (req.method === 'GET') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'Missing draft id' });
      
      const path = `drafts/${id}.json`;
      try {
        const blobMeta = await head(path);
        const data = await readBlobAsJson(blobMeta.url);
        if (!data) return res.status(500).json({ error: 'Failed to read draft data' });
        
        return res.status(200).json(data);
      } catch (err) {
        if (err.message && err.message.includes('BlobNotFoundError')) {
          return res.status(404).json({ error: 'Draft not found' });
        }
        throw err;
      }
    }

    // POST: Save Draft
    if (req.method === 'POST') {
      // Body handling (Vercel parses application/json automatically, but we ensure string to avoid issues)
      let data = req.body;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch { return res.status(400).json({ error: 'Invalid JSON body' }); }
      }
      if (!data) return res.status(400).json({ error: 'Empty body' });

      // Generate random ID for share link (6 chars alphanumeric)
      const randomId = Math.random().toString(36).substring(2, 8);
      const filename = `drafts/${randomId}.json`;

      const blob = await put(filename, JSON.stringify(data), {
        access: 'public',
        addRandomSuffix: false, // Kita kontrol ID-nya sendiri agar mudah dicari
      });

      return res.status(200).json({
        success: true,
        id: randomId,
        url: blob.url,
      });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error('[Blob API Error]', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
