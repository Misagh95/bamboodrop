/**
 * ذخیره‌سازی ایمیل مشترکین
 * از Upstash Redis با REST API استفاده می‌کند (بدون پکیج npm).
 *
 * متغیرهای محیطی لازم (در Vercel تنظیم کن):
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 *
 * اگر تنظیم نشده باشد، حالت fallback فعال می‌شود و فقط no-op برمی‌گرداند
 * تا سایت بدون خطا کار کند.
 */
const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export const isConfigured = () => Boolean(URL && TOKEN);

async function cmd(...args) {
  const res = await fetch(`${URL}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(6000)
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}: ${await res.text()}`);
  return (await res.json()).result;
}

const keyOf = (email) => 'bd:sub:' + email;

/** ایمیل‌ها را به شکل هش نگه می‌داریم تا کلید امن باشد */
const hashKey = () => 'bd:subs:list';

/** افزودن ایمیل. true یعنی تازه ثبت شد، false یعنی قبلاً بوده. */
export async function addEmail(email) {
  if (!isConfigured()) return { ok: false, configured: false, fresh: false };

  const h = keyOf(email);
  // SADD در لیست = ثبت یکتا (جلوی ثبت تکراری را می‌گیرد)
  const added = await cmd('SADD', hashKey(), h);
  if (Number(added) === 0) return { ok: true, configured: true, fresh: false };

  // جزئیات کامل ایمیل در یک هش جدا (HSET فیلد/مقدار می‌خواهد، نه JSON خام)
  await cmd('HSET', h, 'email', email, 'at', new Date().toISOString());
  await cmd('EXPIRE', h, 60 * 60 * 24 * 365 * 2); // ۲ سال
  return { ok: true, configured: true, fresh: true };
}

export async function count() {
  if (!isConfigured()) return 0;
  return Number(await cmd('SCARD', hashKey())) || 0;
}
