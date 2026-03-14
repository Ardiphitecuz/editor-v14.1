// api/video-dl.js
// Endpoint to extract raw MP4 links from TikTok / Instagram Reels

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const isTikTok = url.includes('tiktok.com');
    
    if (isTikTok) {
      // Use TikWM for TikTok
      const tikwmRes = await fetch('https://www.tikwm.com/api/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ url: url, hd: 1 })
      });
      const data = await tikwmRes.json();
      
      if (data.code === 0 && data.data && data.data.play) {
        return res.status(200).json({ url: data.data.play });
      } else {
        return res.status(400).json({ error: data.msg || 'Gagal mengambil video dari TikTok.' });
      }
    } else {
      // Fallback for Instagram or others: we'll try to use widely known public APIs
      // For now, prompt the user to paste direct mp4 links if not TikTok.
      return res.status(400).json({ error: 'Saat ini pengambilan otomatis hanya mendukung link TikTok. Untuk Instagram, gunakan downloader pihak ketiga (seperti SnapInsta) lalu upload videonya secara manual.' });
    }

  } catch (error) {
    console.error("Video DL Error:", error);
    return res.status(500).json({ error: 'Terjadi kesalahan sistem internal.' });
  }
}
