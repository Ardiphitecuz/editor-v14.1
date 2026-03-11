// api/feeds.js — Vercel Serverless Function Endpoint
// File ini berfungsi sebagai "pintu masuk" (endpoint) yang akan 
// meneruskan request POST dari frontend ke mesin newsroom-engine Anda.

import { handleFeedsRequest } from '../backend/newsroom-engine.js';

export const config = {
  maxDuration: 30, // Maksimal 30 detik agar tidak mudah timeout
};

export default async function handler(req, res) {
  // Izinkan CORS (Cross-Origin) jika diakses dari luar
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Tangani preflight request (OPTIONS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Tolak selain GET dan POST
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST or GET.' });
  }

  // Teruskan prosesnya ke engine utama Anda
  return handleFeedsRequest(req, res);
}