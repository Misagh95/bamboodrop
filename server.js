/**
 * BambooDrop — سرور توسعه‌ی محلی
 * (روی Vercel از api/*.js استفاده می‌شود؛ این فایل فقط برای تست روی لوکال است)
 *
 * اجرا:  npm run dev     →  http://localhost:3000
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getData, CACHE_TTL } from './lib/telegram.js';
import { loadEnv } from './lib/env.js';

loadEnv();   // متغیرهای .env را می‌خواند (در Vercel وجود ندارد، بی‌اثر است)

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp', '.png': 'image/png'
};

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// کش در حافظه (فقط برای توسعه‌ی محلی؛ روی Vercel کش لبه انجام می‌شود)
let cache = null;
let cacheTs = 0;
async function cached() {
  if (cache && Date.now() - cacheTs < CACHE_TTL) return cache;
  cache = await getData();
  cacheTs = Date.now();
  log(`updated | subs=${cache.stats.subscribers} drops=${cache.drops.length}`);
  return cache;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const send = (code, obj) => {
    const b = Buffer.from(JSON.stringify(obj, null, 2));
    res.writeHead(code || 200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': b.length,
      'Access-Control-Allow-Origin': '*'
    });
    res.end(b);
  };

  try {
    if (url.pathname === '/api/all') {
      const d = await cached();
      return send(200, d);
    }
    if (url.pathname === '/api/stats') {
      const d = await cached();
      return send(200, { updatedAt: d.updatedAt, channel: d.channel, group: d.group, stats: d.stats, stale: d.stale });
    }
    if (url.pathname === '/api/drops') {
      const d = await cached();
      return send(200, { updatedAt: d.updatedAt, drops: d.drops, stale: d.stale });
    }
    if (url.pathname === '/api/posts') {
      const d = await cached();
      const limit = Math.min(Number(url.searchParams.get('limit') || 20), 50);
      return send(200, { updatedAt: d.updatedAt, posts: d.posts.slice(0, limit), stale: d.stale });
    }
    if (url.pathname === '/api/refresh') {
      cacheTs = 0;
      return send(200, await cached());
    }
    if (url.pathname === '/api/subscribe') {
      // هندلرهای Vercel از res.status().json() استفاده می‌کنند که در Node نیست
      const { default: handler } = await import('./api/subscribe.js');
      const body = await new Promise((resolve) => {
        let raw = '';
        req.on('data', (c) => (raw += c));
        req.on('end', () => {
          try { resolve(JSON.parse(raw)); } catch { resolve({}); }
        });
      });
      res.status = (c) => { res.statusCode = c; return res; };
      res.json = (o) => send(res.statusCode || 200, o);
      return handler({ method: req.method, body, query: Object.fromEntries(url.searchParams), headers: req.headers }, res);
    }

    // فایل‌های استاتیک از public/ (همان رفتاری که Vercel دارد)
    const rel = url.pathname === '/' ? '/index.html' : url.pathname;
    const file = path.join(__dirname, 'public', rel);
    if (!file.startsWith(path.join(__dirname, 'public')) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404');
    }
    const isSticker = rel.startsWith('/stickers/');
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': isSticker ? 'public, max-age=31536000, immutable' : 'no-cache'
    });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    send(500, { error: e.message });
  }
});

cached();
setInterval(() => cached(), CACHE_TTL);

server.listen(PORT, () => log(`BambooDrop → http://localhost:${PORT}`));
