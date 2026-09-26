/**
 * سرور تست که پروتکل Upstash REST را تقلید می‌کند.
 * فقط برای اطمینان از درست‌کارکردن lib/store.js — در پروداکشن استفاده نمی‌شود.
 * اجرا:  node mock-upstash.js   (پورت 9099)
 */
import http from 'node:http';

const sets = new Map();
const hashes = new Map();

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => (body += c));
  req.on('end', () => {
    let args = [];
    try { args = JSON.parse(body); } catch { /* ignore */ }
    const [cmd, ...rest] = args;
    let result = null;

    switch (String(cmd).toUpperCase()) {
      case 'SADD': {
        const s = sets.get(rest[0]) || new Set();
        const before = s.size;
        rest.slice(1).forEach(m => s.add(m));
        sets.set(rest[0], s);
        result = s.size - before;
        break;
      }
      case 'SCARD':
        result = (sets.get(rest[0]) || new Set()).size;
        break;
      case 'HSET':
        hashes.set(rest[0], rest[1]);
        result = 1;
        break;
      case 'HGET':
        result = hashes.get(rest[0]) ?? null;
        break;
      case 'EXPIRE':
        result = 1;
        break;
      default:
        result = null;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ result }));
  });
});

server.listen(9099, () => console.log('mock-upstash on http://localhost:9099'));
