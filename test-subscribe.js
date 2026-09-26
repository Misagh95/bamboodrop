/**
 * تست یکپارچه‌ی /api/subscribe (فقط توسعه)
 * اجرا:  node test-subscribe.js
 * نیازمند: mock-upstash.js و server.js در حال اجرا با متغیرهای محیطی
 */
const BASE = 'http://localhost:3000';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const post = (email) => fetch(`${BASE}/api/subscribe`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email })
}).then(async r => ({ status: r.status, body: await r.json() }));

const get = () => fetch(`${BASE}/api/subscribe`).then(async r => ({ status: r.status, body: await r.json() }));

const run = async () => {
  const email = 'test' + Date.now() + '@example.com';
  let fail = 0;
  const check = (name, cond, extra = '') => {
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
    if (!cond) fail++;
  };

  let r = await get();
  check('GET returns 200', r.status === 200, JSON.stringify(r.body));

  r = await post(email);
  check('POST new email -> 200 + fresh', r.status === 200 && r.body.ok && r.body.fresh, JSON.stringify(r.body));

  r = await post(email);
  check('POST duplicate -> not fresh', r.status === 200 && r.body.ok && r.body.fresh === false, JSON.stringify(r.body));

  r = await post(email.toUpperCase());
  check('case-insensitive dedupe', r.status === 200 && r.body.fresh === false, JSON.stringify(r.body));

  r = await post('not-an-email');
  check('invalid email -> 400', r.status === 400 && r.body.error === 'invalid_email', JSON.stringify(r.body));

  r = await post('a@b.c');
  check('short tld -> 400', r.status === 400, JSON.stringify(r.body));

  r = await post('x'.repeat(300) + '@a.com');
  check('overlong email -> 400', r.status === 400);

  r = await get();
  check('GET count >= 1', r.status === 200 && r.body.count >= 1, JSON.stringify(r.body));

  // XSS /注入 sanity
  r = await post('<script>alert(1)</script>@x.com');
  check('weird input -> 400', r.status === 400, JSON.stringify(r.body));

  console.log(fail === 0 ? '\nهمه تست‌ها موفق ✓' : `\n${fail} تست ناموفق`);
  process.exit(fail === 0 ? 0 : 1);
};

run();
