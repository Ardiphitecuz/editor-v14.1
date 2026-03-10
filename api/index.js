// api/index.js — Vercel Serverless Function entry point
// Semua request /api/* dirouting ke sini via vercel.json
// Express app di-import dari server.js dan diekspos sebagai handler

import app from '../server.js';

export default app;