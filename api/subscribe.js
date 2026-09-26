import { addEmail, count, isConfigured } from '../lib/store.js';

export const config = { runtime: 'nodejs18.x', maxDuration: 10 };

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"\s]+\.[^\s@<>()[\]\\,;:"\s]{2,}$/;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  // GET → تعداد مشترکین (برای نمایش در سایت)
  if (req.method === 'GET') {
    return res.status(200).json({ count: await count(), configured: isConfigured() });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let email = '';
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    email = String(body.email || '').trim().toLowerCase();
  } catch {
    return res.status(400).json({ error: 'bad_json' });
  }

  if (!EMAIL_RE.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'invalid_email' });
  }

  try {
    const r = await addEmail(email);
    if (!r.configured) {
      // Redis تنظیم نشده — صادقانه به کلاینت می‌گوییم ثبت نشد
      return res.status(503).json({ error: 'not_configured' });
    }
    return res.status(200).json({ ok: true, fresh: r.fresh, count: await count() });
  } catch (e) {
    return res.status(500).json({ error: 'store_failed' });
  }
}
