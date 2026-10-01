const API = location.protocol === 'file:' ? null : (location.origin + '/api');

/* ---------- داده‌های واقعی از سرور (تلگرام) ---------- */

let liveStats = { subscribers: 0, members: 0, online: 0, posts: 0 };

const fa = new Intl.RelativeTimeFormat('fa', { numeric: 'auto' });
function timeAgo(iso) {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return fa.format(-Math.max(1, Math.round(s / 60)), 'minute');
  if (s < 86400) return fa.format(-Math.round(s / 3600), 'hour');
  return fa.format(-Math.round(s / 86400), 'day');
}

/* ---------- کارت پروژه‌ها (بر اساس هشتگ) ---------- */

const el = (id) => document.getElementById(id);
const projGrid = el('projectGrid');
const tagsFilter = el('tagsFilter');
let activeTag = null;
let allProjects = [];

function projectHTML(p) {
  const extras = p.count - 1;   // پست اول در عنوان است
  return `<article class="pcard">
    <div class="pcard__head">
      <a class="pcard__tag" href="#projects" data-tag="${esc(p.slug)}">#${esc(p.tag)}</a>
      <div class="pcard__badges">
        ${p.drops > 0 ? `<span class="badge badge--new">ایردراپ فعال</span>` : ''}
        <span class="pcard__count">${p.count.toLocaleString('fa-IR')} پست</span>
      </div>
    </div>
    <p class="pcard__title">${esc(p.title)}</p>
    <div class="pcard__meta">
      <span>آخرین: ${timeAgo(p.latest)}</span>
    </div>
    ${extras > 0 ? `<button class="pcard__toggle" type="button" data-tag="${esc(p.slug)}">
        ${extras.toLocaleString('fa-IR')} پیام دیگر <span class="pcard__chev">⌄</span>
      </button>` : ''}
    <ul class="pcard__more" hidden>
      ${p.posts.slice(1).map(x => `<li>
        <a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.text.replace(/\s+/g, ' ').slice(0, 90))}</a>
        <span>${timeAgo(x.date)}</span>
      </li>`).join('')}
    </ul>
    <a class="card__cta" href="${esc(p.link)}" target="_blank" rel="noopener nofollow">مشاهده پروژه ←</a>
  </article>`;
}

function renderProjects(projects) {
  if (!projects?.length) {
    projGrid.innerHTML = '<p class="empty">هنوز پروژه‌ای با هشتگ پیدا نشد.</p>';
    tagsFilter.innerHTML = '';
    return;
  }
  projGrid.innerHTML = projects.map(projectHTML).join('');

  tagsFilter.innerHTML = `<button class="tfilter is-active" data-tag="">همه (${projects.length})</button>`
    + projects.map(p => `<button class="tfilter" data-tag="${esc(p.slug)}">#${esc(p.tag)}</button>`).join('');

  document.querySelectorAll('.card').forEach(n => io.observe(n));
}

// باز/بسته کردن پیام‌های هر پروژه
projGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('.pcard__toggle');
  if (!btn) return;
  const list = btn.nextElementSibling;
  const open = list.hasAttribute('hidden');
  list.toggleAttribute('hidden', !open);
  btn.classList.toggle('is-open', open);
});

// فیلتر بر اساس هشتگ
tagsFilter.addEventListener('click', (e) => {
  const btn = e.target.closest('.tfilter');
  if (!btn) return;
  activeTag = btn.dataset.tag || null;
  document.querySelectorAll('.tfilter').forEach(b => b.classList.toggle('is-active', b === btn));
  applyFilter();
});

function applyFilter() {
  const list = activeTag ? allProjects.filter(p => p.slug === activeTag) : allProjects;
  projGrid.innerHTML = list.map(projectHTML).join('');
    if (activeTag) {
    const first = projGrid.querySelector('.pcard');
    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}
const grid = el('dropGrid');
const feedList = el('feedList');
const faqList = el('faqList');

/* ---------- چت تصویری با استیکرها ---------- */

// استیکرهای پک اختصاصی بامبو دراپ — بر اساس موضوع پیام انتخاب می‌شوند
const STICKERS = [
  '01_01_channel_check_angry.webp',
  '02_02_nostradamus_smug.webp',
  '03_03_not_checking_surprised.webp',
  '04_04_be_like_bamboo_thinking.webp',
  '05_05_project_hashtag_bored.webp',
  '06_06_irancell_angry.webp',
  '07_07_listen_my_child_advice.webp',
  '08_08_fifo_mysterious.webp',
  '09_09_power_cut_angry.webp',
  '10_10_net_cut_cursing.webp',
  '11_11_why_no_channel_tired.webp',
  '12_12_do_your_tasks_bossy.webp'
];
const STICKER_BASE = '/stickers/';

// انتخاب استیکر بر اساس محتوای پیام تا حس «نظر ادمین» بدهد
const STICKER_RULES = [
  { re: /هک|جعلی|کلاهبردار|فیشینگ|اسکم|مراقب/i, i: 0 },
  { re: /چشم|بینی|نظر|حدس|میدونی|شاید|احتمال/i, i: 1 },
  { re: /غافلگیر|سورپرایز|واقعا|جدید|finally/i, i: 2 },
  { re: /چرا|چطور|چیست|یعنی چی/i, i: 3 },
  { re: /هشتگ|#\w+|پروژه/i, i: 4 },
  { re: /اینترنت|نت|مودم|قطع|تاخیر|کند/i, i: 5 },
  { re: /گوش بده|بشنو|توجه|نکته/i, i: 6 },
  { re: /پیشنهاد|فرصت|شانس/i, i: 7 },
  { re: /برق|قطعی|نور|انرژی/i, i: 8 },
  { re: /عصب|عصبی|مسخره|宰|خر/i, i: 9 },
  { re: /کانال|عضو|دنبال|فالو/i, i: 10 },
  { re: /تسک|ایردراپ|انجام|بزن|کلیم/i, i: 11 }
];

function pickSticker(text) {
  for (const r of STICKER_RULES) if (r.re.test(text)) return STICKER_BASE + STICKERS[r.i];
  return null;
}

function hostOf(u) {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return String(u).slice(0, 26); }
}

function chatHTML(p) {
  const text = p.text || '';
  const sticker = pickSticker(text);
  const links = (p.links || []).slice(0, 3);

  const media = sticker
    ? `<div class="bubble bubble--media">
         <img src="${esc(sticker)}" alt="" loading="lazy" decoding="async"
              onclick="window.__bdZoom(this.src)" />
         ${text ? `<div class="bubble__caption">${esc(text.length > 150 ? text.slice(0, 150) + '…' : text)}</div>` : ''}
       </div>`
    : `<div class="bubble">${esc(text || '(پیام بدون متن)')}</div>`;

  return `<article class="msg" data-id="${esc(p.id)}">
    <a class="msg__av" href="https://t.me/${esc(String(p.post).split('/')[0])}" target="_blank" rel="noopener"
       aria-label="کانال BambooDrop">B</a>
    <div class="msg__body">
      <div class="msg__head">
        <a class="msg__author" href="https://t.me/${esc(String(p.post).split('/')[0])}" target="_blank" rel="noopener">BambooDrop</a>
        <a class="msg__time" href="${esc(p.url)}" target="_blank" rel="noopener" title="${esc(p.date || '')}">${timeAgo(p.date)}</a>
      </div>
      ${media}
      ${links.length ? `<div class="bubble__links">${links.map(u =>
        `<a class="bubble__link" href="${esc(u)}" target="_blank" rel="noopener nofollow">↗ ${esc(hostOf(u))}</a>`).join('')}</div>` : ''}
      <div class="bubble__foot">
        <a href="${esc(p.url)}" target="_blank" rel="noopener">مشاهده در تلگرام</a>
        ${p.views ? `<span>👁 ${esc(p.views)}</span>` : ''}
      </div>
    </div>
  </article>`;
}

let firstRender = true;
function renderFeed(posts) {
  const box = el('feedList');
  if (!posts?.length) {
    box.innerHTML = '<p class="empty">هنوز پیامی برای نمایش نیست.</p>';
    return;
  }
  const list = posts.slice(0, 20).reverse();   // جدیدترین پایین، مثل چت
  const hasNew = !firstRender && el('feedList').dataset.first !== posts[0].id;

  box.innerHTML = list.map(chatHTML).join('')
    + '<p class="feed__more"><a href="https://t.me/Bamboodrop" target="_blank" rel="noopener">دیدن همه در کانال ←</a></p>';

  box.dataset.first = posts[0].id;
  firstRender = false;

  if (hasNew) {
    box.querySelector('.msg:last-of-type')?.classList.add('is-new');
    el('newBadge')?.classList.add('is-show');
  }
  // اسکرول به آخرین پیام
  requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; });
}

const FAQ = [
  ["آیا رایگان است؟", "بله. بامبو دراپ هیچ هزینه‌ای دریافت نمی‌کنه و فقط ایردراپ‌های مناسب رو معرفی می‌کنه."],
  ["آیا کیف پول لازم دارم؟", "برای تسک‌های Testnet معمولاً یه کیف پول رایگان مثل MetaMask کافیه. برای ایردراپ‌های شبکه اصلی مقدار کمی فی لازم می‌شه."],
  ["اطلاعات کیف پولم امن می‌مونه؟", "ما هیچ‌وقت seed phrase یا کلید خصوصی شما رو نمی‌خوایم. هیچ سایتی جز سایت رسمی پروژه رو تأیید نمی‌کنیم."],
  ["چطور می‌تونم کمک کنم؟", "توی گروه گفتگو تجربه‌ت رو بگو یا ادمین @Bamboodrop00 رو پیام بده."],
  ["سواستم رو جواب ندادند چیکار کنم؟", "سوالت رو با جزئیات کامل (اسم پروژه و کاری که کردی) توی گروه بذار؛ معمولاً سریع پاسخ داده می‌شه."],
  ["محتوای سایت چقدر تازه‌ست؟", "این صفحه مستقیم از کانال تلگرام خوانده می‌شه و هر یک دقیقه به‌روزرسانی می‌شه."]
];

function cardHTML(d) {
  return `<article class="card">
    <div class="card__top">
      <h3>${esc(d.title)}</h3>
      <span class="badge ${d.status === 'جدید' ? 'badge--new' : 'badge--ok'}">${esc(d.status)}</span>
    </div>
    <p class="card__desc">${esc(d.desc)}</p>
    <ul class="card__meta">
      <li><span>شبکه</span><b>${esc(d.network)}</b></li>
      <li><span>بازدید</span><b>${esc(d.views || '—')}</b></li>
      <li><span>زمان</span><b>${timeAgo(d.date)}</b></li>
    </ul>
    <a class="card__cta" href="${esc(d.link)}" target="_blank" rel="noopener nofollow">مشاهده پروژه ←</a>
    <a class="card__src" href="${esc(d.channelUrl)}" target="_blank" rel="noopener">منبع: کانال</a>
  </article>`;
}

function esc(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderStats(s) {
  const set = (id, v) => {
    const n = el(id);
    if (!n) return;
    const target = +v || 0;
    let cur = 0;
    const step = Math.max(1, Math.round(target / 40));
    clearInterval(n._t);
    n._t = setInterval(() => {
      cur += step;
      if (cur >= target) { cur = target; clearInterval(n._t); }
      n.textContent = cur.toLocaleString('fa-IR');
    }, 25);
  };
  set('statSubs', s.subscribers);
  set('statMembers', s.members);
  set('statOnline', s.online);
}

async function load() {
  if (!API) {
    grid.innerHTML = '<p class="empty">برای دیدن داده‌های زنده، سایت را با <code>npm run dev</code> اجرا کنید.</p>';
    return;
  }
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 12000);
    const r = await fetch(`${API}/all`, { signal: ctl.signal });
    clearTimeout(timer);
    if (!r.ok) throw new Error('HTTP ' + r.status);

    const d = await r.json();
    liveStats = d.stats || liveStats;
    renderStats(liveStats);
    el('updatedAt').textContent = timeAgo(d.updatedAt);
    document.body.classList.toggle('is-stale', !!d.stale);

    grid.innerHTML = d.drops?.length
      ? d.drops.map(cardHTML).join('')
      : '<p class="empty">در حال حاضر ایردراپ فعالی ثبت نشده. کانال را دنبال کنید.</p>';

    renderFeed(d.posts);

    allProjects = d.projects || [];
    renderProjects(allProjects);

    document.querySelectorAll('.card, .step, .faq__item').forEach(n => io.observe(n));
  } catch (e) {
    grid.innerHTML = '<p class="empty">دریافت اطلاعات ممکن نشد. لطفاً کانال تلگرام را ببینید.</p>'
      + '<p class="empty"><a href="https://t.me/Bamboodrop" target="_blank" rel="noopener">@Bamboodrop</a></p>';
  }
}

faqList.innerHTML = FAQ.map(([q, a], i) => `
  <div class="faq__item ${i === 0 ? 'is-open' : ''}">
    <button class="faq__q" aria-expanded="${i === 0}">${esc(q)}<span class="chev">⌄</span></button>
    <div class="faq__a"><p>${esc(a)}</p></div>
  </div>`).join('');


faqList.addEventListener('click', e => {
  const btn = e.target.closest('.faq__q');
  if (!btn) return;
  const item = btn.parentElement;
  const open = item.classList.toggle('is-open');
  btn.setAttribute('aria-expanded', open);
});

// ── بزرگ‌نمایی تصویر (لایت‌باک ساده) ─────────────────────
window.__bdZoom = (src) => {
  let ov = document.getElementById('bdOv');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'bdOv';
    ov.className = 'lightbox';
    ov.innerHTML = '<img alt="" /><button type="button" aria-label="بستن">✕</button>';
    document.body.appendChild(ov);
    ov.addEventListener('click', (e) => {
      if (e.target.tagName === 'IMG') return;
      ov.classList.remove('is-open');
    });
    addEventListener('keydown', (e) => { if (e.key === 'Escape') ov.classList.remove('is-open'); });
  }
  ov.querySelector('img').src = src;
  ov.classList.add('is-open');
};

// ── ثبت‌نام خبرنامه ─────────────────────────────────────
// بدون بک‌اند، ایمیل فقط در مرورگر ذخیره می‌شود (localStorage).
// برای ذخیره‌ی واقعی سمت سرور باید /api/subscribe ساخته شود.
const SUB_KEY = 'bd_subscribed';

function initSubscribe() {
  const form = el('subForm'), input = el('subEmail'), msg = el('subMsg'), btn = el('subBtn');
  if (!form) return;

  if (localStorage.getItem(SUB_KEY)) {
    input.value = localStorage.getItem(SUB_KEY);
    btn.textContent = 'ثبت شده ✓';
    btn.disabled = true;
    msg.className = 'sub__msg ok';
    msg.textContent = 'ایمیل شما ذخیره شده است.';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = input.value.trim();

    if (!/^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"\s]+\.[^\s@<>()[\]\\,;:"\s]{2,}$/.test(email)) {
      msg.className = 'sub__msg err';
      msg.textContent = 'لطفاً یک ایمیل معتبر وارد کنید.';
      return;
    }

    btn.disabled = true;
    const old = btn.textContent;
    btn.textContent = 'در حال ثبت…';

    try {
      let saved = false;
      if (API) {
        // اگر بعداً /api/subscribe ساخته شد، اینجا واقعاً ثبت می‌شود
        const r = await fetch(`${API}/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        saved = r.ok;
      }
      if (!saved) { localStorage.setItem(SUB_KEY, email); }

      localStorage.setItem(SUB_KEY, email);
      btn.textContent = 'ثبت شده ✓';
      msg.className = 'sub__msg ok';
      msg.textContent = 'ثبت شد! ایمیل جدیدترین ایردراپ‌ها را برایت می‌فرستیم.';
    } catch {
      localStorage.setItem(SUB_KEY, email);
      btn.textContent = 'ثبت شده ✓';
      msg.className = 'sub__msg ok';
      msg.textContent = 'ثبت شد (حالت آفلاین).';
    }
  });
}

// ── اشتراک‌گذاری ─────────────────────────────────────────
function initShare() {
  const btn = el('shareBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const data = { title: document.title, text: 'بامبو دراپ — جدیدترین ایردراپ‌ها', url: location.href };
    if (navigator.share) {
      try { await navigator.share(data); return; } catch { /* کاربر لغو کرد */ }
    }
    try {
      await navigator.clipboard.writeText(location.href);
      const old = btn.textContent;
      btn.textContent = '✓ لینک کپی شد';
      setTimeout(() => (btn.textContent = old), 2200);
    } catch {
      window.open('https://t.me/share/url?url=' + encodeURIComponent(location.href)
        + '&text=' + encodeURIComponent(data.text), '_blank', 'noopener');
    }
  });
}

el('year').textContent = new Date().getFullYear();

// منوی موبایل
const burger = el('burger');
const links = el('navLinks');
burger.addEventListener('click', () => links.classList.toggle('is-open'));
links.addEventListener('click', e => { if (e.target.tagName === 'A') links.classList.remove('is-open'); });

// نوار بالا هنگام اسکرول
const nav = el('nav');
addEventListener('scroll', () => nav.classList.toggle('is-sticky', scrollY > 20));

// ریویل هنگام اسکرول
const io = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}), { threshold: .15 });
document.querySelectorAll('.step, .faq__item').forEach(n => io.observe(n));

// بارگذاری داده‌ی زنده + تازه‌سازی خودکار هر ۶۰ ثانیه
initSubscribe();
initShare();
load();
setInterval(() => {
  load();
  if (el('statOnline') && liveStats.online != null) el('statOnline').textContent = liveStats.online.toLocaleString('fa-IR');
  // بَج «پیام جدید» بعد از ۱۰ ثانیه محو می‌شود
  setTimeout(() => el('newBadge')?.classList.remove('is-show'), 10000);
}, 60000);

