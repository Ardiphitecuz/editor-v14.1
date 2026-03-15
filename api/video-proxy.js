// api/video-proxy.js
// Dedicated proxy for video files to solve CORS issues on mobile browsers
import axios from 'axios';

export const config = { maxDuration: 30 };

async function handle(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ success: false, error: 'URL is required' });

  const parsed = new URL(url);
  // Pass through the Range header from the client
  const rangeHeader = req.headers.range;
  const axiosHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Referer': parsed.origin,
  };
  if (rangeHeader) {
    axiosHeaders['Range'] = rangeHeader;
  }

  try {
    const response = await axios.get(url, {
      timeout: 30000,
      responseType: 'stream',
      headers: axiosHeaders,
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 300 || status === 206,
    });

    // Pass through relevant headers
    const headersToPass = [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'cache-control'
    ];

    headersToPass.forEach(h => {
      if (response.headers[h]) res.setHeader(h, response.headers[h]);
    });
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.status(response.status);
    response.data.pipe(res);
  } catch (error) {
    console.error("Video Proxy Error:", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export default handle;
