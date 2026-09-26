/** بررسی اتصال Upstash — اجرا: node check-upstash.js */
import fs from 'node:fs';

const text = fs.readFileSync('.env', 'utf8').replace(/^﻿/, '');
const env = {};
for (const line of text.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const url = env.UPSTASH_REDIS_REST_URL;
const token = env.UPSTASH_REDIS_REST_TOKEN;
const vUrl = env.UPSTASH_VECTOR_REST_URL;
const vTok = env.UPSTASH_VECTOR_REST_TOKEN;

console.log('--- کلیدهای موجود در .env ---');
console.log(Object.keys(env).join('\n'));

const ping = async (name, u, t) => {
  if (!u || !t) { console.log(`\n${name}: متغیر موجود نیست`); return; }
  try {
    const r = await fetch(u, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
      body: JSON.stringify(['PING'])
    });
    const body = await r.text();
    console.log(`\n${name}: HTTP ${r.status}  ${body.slice(0, 200)}`);
  } catch (e) {
    console.log(`\n${name}: خطا → ${e.message}`);
  }
};

await ping('REDIS', url, token);
await ping('VECTOR', vUrl, vTok);
