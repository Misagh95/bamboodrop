/** تست سرعت خواندن آرشیو — اجرا: node bench-archive.js [pages] */
const PAGES = Number(process.argv[2] || 20);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36';
const CH = 'Bamboodrop';

const fetchText = (url) => fetch(url, {
  headers: { 'User-Agent': UA },
  signal: AbortSignal.timeout(8000)
}).then(r => { if (!r.ok) throw new Error(r.status); return r.text(); });

const idsOf = (html) => [...html.matchAll(new RegExp(`data-post="${CH}/(\\d+)"`, 'g'))]
  .map(m => Number(m[1]));

const t0 = Date.now();
const first = await fetchText(`https://t.me/s/${CH}`);
let cursor = Math.min(...idsOf(first));
const seen = new Set(idsOf(first));
const pages = [first];

// همزمان ۳ صفحه جلوتر را حدس می‌زنیم تا درخواست‌ها موازی شوند
let batch = [cursor];
for (let round = 1; round <= Math.ceil(PAGES / 3) && batch.length; round++) {
  batch = batch.slice(0, 3);
  const results = await Promise.all(batch.map(async (b) => {
    try { return await fetchText(`https://t.me/s/${CH}?before=${b}`); } catch { return ''; }
  }));
  const next = [];
  for (const html of results) {
    if (!html) continue;
    const ids = idsOf(html);
    const fresh = ids.filter(i => !seen.has(i));
    if (!fresh.length) continue;
    fresh.forEach(i => seen.add(i));
    pages.push(html);
    next.push(Math.min(...fresh));
  }
  if (!next.length) break;
  batch = next;
}

const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`pages=${pages.length}  unique_posts=${seen.size}  oldest=${Math.min(...seen)}  time=${secs}s`);
