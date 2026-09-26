/**
 * BambooDrop — هسته‌ی منطق (مشترک بین اجرای محلی و Vercel)
 * ESM — بدون هیچ پکیج خارجی، فقط fetch داخلی Node 18+
 */
export const CHANNEL = process.env.CHANNEL || 'Bamboodrop';
export const GROUP = process.env.GROUP || 'Bamboodropgroup';
export const CACHE_TTL = 60 * 1000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const stripTags = (s = '') => s
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
  .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
  .trim();

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'en' },
    signal: AbortSignal.timeout(8000)
  });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return await res.text();
}

const num = (s) => {
  if (!s) return 0;
  const m = String(s).trim().replace(/\s/g, '').toUpperCase();
  const v = parseFloat(m.replace('K', '')) * (m.includes('K') ? 1000 : 1);
  return isNaN(v) ? 0 : Math.round(v);
};

// ── طبقه‌بندی پیام‌ها ────────────────────────────────────────
// فیلتر قبلی فقط کلیدواژه داشت و پست‌های خبری/نظری هم قاطی ایردراپ‌ها می‌شدند.
// اینجا با امتیازدهی مثبت/منفی تصمیم می‌گیریم.

const NEGATIVE = [
  { re: /بنظرتون|به نظر شما|نظراتتون|کسی(?:جوری|ها)?\s*می(?:دونه|دونن)/i, w: 3 },   // نظر و پرسش
  { re: /^\s*🚨|مراقب (?:این|کپچا)|صفحه(?:ی|ٔ)? جعلی|فیشینگ|کلاهبردار|اسکم/i, w: 3 }, // هشدار امنیتی
  { re: /قیمت (?:بیت|اتر|سکه)|نرخ (?:بیت|دلار)|صرافی|بیت‌گت|بایننس|پیش ?فروش|presale/i, w: 2 },
  { re: /کمیسیون|قوانین|حکم|دادگاه|\bSEC\b/i, w: 2 },                             // اخبار مالی/حقوقی
  { re: /^\s*(?:اخبار|گزارش)|تحلیل|بررسی قیمت|مرور سریع/i, w: 2 },
  { re: /t\.me\/(?!Bamboodrop)[\w_]*(?:news|neews)/i, w: 3 }                       // لینک به کانال خبری
];

const POSITIVE = [
  { re: /ایردراپ|ایر ?دراپ|airdrop/i, w: 3 },
  { re: /تست ?نت|testnet/i, w: 2 },
  { re: /تسک|task|quest|مأموریت|ماموریت/i, w: 2 },
  { re: /کلیم|claim|دریافت|جمع‌آوری|برداشت|领取/i, w: 2 },
  { re: /بزنید|بزن|شرکت کنید|مشارکت|انجام (?:بدید|دهید)|وارد سایت|کلیک کنید/i, w: 2 },
  { re: /باج|badge|امتیاز|\bXP\b|پوینت|نقاط/i, w: 2 },
  { re: /سیزن|season|مرحله|دور اول/i, w: 1 },
  { re: /جواب (?:کوییز|کویز)|کوییز|کویز|پیشنهاد|فرصت/i, w: 2 }
];

// لینک‌هایی که فقط «مطلب» هستند، نه اقدام‌پذیر
const INFO_HOSTS = /calculator|wiki|medium|substack|^https?:\/\/(?:www\.)?t\.me\//i;

// لینک‌هایی که صرفاً ارجاع/اشتراک‌گذاری‌اند و نشانه‌ی «اقدام» نیستند
const SOCIAL = /^https?:\/\/(?:www\.)?(?:x|twitter|t\.me|instagram|telegram|medium)\./i;

// فراخوانِ اقدام: حتی بدون لینک هم می‌تواند ایردراپ باشد (مثلاً پست کوییز)
const CALL_TO_ACTION = /کلیم|بزنید|بزن|کوییز|کویز|انجام بدید|وارد سایت|کلیک کنید/i;

// لینک‌هایی که واقعاً کاربر باید در آن‌ها تسک انجام دهد
const ACTION_HOSTS = /app\.|quest|claim|testnet|guild|airdrop|mint|portal|dashboard/i;

function classify(text, links) {
  // امتیاز پایه از مثبت/منفی (همیشه محاسبه می‌شود)
  let score = 0;
  for (const { re, w } of POSITIVE) if (re.test(text)) score += w;
  for (const { re, w } of NEGATIVE) if (re.test(text)) score -= w;

  // هشدار امنیتی یا نظر/پرسش → هرگز ایردراپ نیست
  if (score < 0) return { isDrop: false, score };

  // لینک‌های شبکه‌های اجتماعی و مطلبی، نشانه‌ی «اقدام» نیستند
  const real = links.filter(u => !SOCIAL.test(u) && !INFO_HOSTS.test(u));
  const strong = real.filter(u => ACTION_HOSTS.test(u));

  // دامنه‌ی اپلیکیشن (app./quest/…) همراه با نبودِ هشدار → تسک است
  if (strong.length) return { isDrop: true, score: Math.max(score, 3) };

  // نه لینک اقدامی داریم، نه فراخوان صریح → ایردراپ نیست
  if (!real.length && !CALL_TO_ACTION.test(text)) return { isDrop: false, score };

  return { isDrop: score >= 2, score };
}

function parseChannel(html) {
  const segments = html.split('tgme_widget_message_wrap js-widget_message').slice(1);
  const seen = new Set();
  const posts = [];

  for (const seg of segments) {
    const post = (seg.match(/data-post="([^"]+)"/) || [])[1];
    if (!post || seen.has(post)) continue;
    seen.add(post);

    const raw = (seg.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/) || [])[1] || '';
    const text = stripTags(raw);
    const links = [...new Set(raw.match(/https?:\/\/[^\s"'<>)\]]+/g) || [])]
      .map(u => u.replace(/&amp;/g, '&'))
      .filter(u => !new RegExp(`t\\.me/(s/)?${CHANNEL}`, 'i').test(u));

    const c = classify(text, links);
    posts.push({
      id: (post.match(/_(\d+)$/) || [])[1] || post,
      post,
      url: (seg.match(/<a class="tgme_widget_message_date"[^>]*href="([^"]+)"/) || [])[1] || `https://t.me/${post}`,
      text, links,
      date: (seg.match(/datetime="([^"]+)"/) || [])[1] || null,
      views: (seg.match(/<span class="tgme_widget_message_views">([^<]+)<\/span>/) || [])[1]?.trim() || null,
      isAirdrop: c.isDrop,
      score: c.score || 0
    });
  }
  return posts;
}

function buildDrops(posts) {
  return posts.filter(p => p.isAirdrop).slice(0, 12).map((p, i) => {
    const line = p.text.split('\n').find(l => l.trim()) || p.text;
    const net = p.text.match(/\b(ETH|BNB|BSC|SOL|ARB|OP|BASE|AVAX|TON|SUI|APT|LINEA|SCROLL|POLYGON|ETHEREUM|SOLANA|ARBITRUM)\b/i);
    return {
      id: p.id,
      title: line.length > 70 ? line.slice(0, 70) + '…' : line,
      desc: p.text.length > 240 ? p.text.slice(0, 240) + '…' : p.text,
      network: net ? net[1].toUpperCase() : '—',
      link: p.links[0] || p.url,
      channelUrl: p.url,
      date: p.date,
      views: p.views,
      status: i === 0 ? 'جدید' : 'فعال',
      tag: /airdrop|ایردراپ/i.test(p.text) ? 'airdrop' : 'task'
    };
  });
}

async function fetchCounts() {
  const out = { subscribers: 0, members: 0, online: 0 };
  const grab = (src) => {
    const m = src.match(/([\d][\d\s,\.]*[KM]?)\s*(subscribers|members)/i);
    const o = src.match(/([\d][\d\s,\.]*[KM]?)\s*online/i);
    return { n: m ? m[1] : null, on: o ? o[1] : null };
  };
  const jobs = [
    [`https://t.me/${CHANNEL}`, s => { const g = grab(s); out.subscribers = num(g.n); }],
    [`https://t.me/${GROUP}`, s => { const g = grab(s); out.members = num(g.n) || out.members; out.online = num(g.on); }]
  ];
  await Promise.all(jobs.map(async ([url, apply]) => {
    try { apply(await fetchText(url)); } catch { /* بی‌خیال */ }
  }));
  return out;
}

/** داده‌ی کامل. stale=true یعنی از کش قدیمی یا fallback برگشته. */
export async function getData() {
  try {
    const [chanHtml, counts] = await Promise.all([
      fetchText(`https://t.me/s/${CHANNEL}`),
      fetchCounts()
    ]);
    const posts = parseChannel(chanHtml);
    return {
      updatedAt: new Date().toISOString(),
      channel: CHANNEL, group: GROUP,
      stats: { ...counts, posts: posts.length },
      posts: posts.slice(0, 30),
      drops: buildDrops(posts),
      stale: false
    };
  } catch (e) {
    return {
      updatedAt: new Date().toISOString(),
      channel: CHANNEL, group: GROUP,
      stats: { subscribers: 0, members: 0, online: 0, posts: 0 },
      posts: [], drops: [],
      stale: true, error: e.message
    };
  }
}
