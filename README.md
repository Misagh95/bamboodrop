# 🪂 BambooDrop

سایت لندینگ بامبو دراپ با داده‌های زنده‌ی کانال تلگرام.

## اجرای محلی

```bash
npm run dev      # → http://localhost:3000
```

## دیپلوی روی Vercel

**روش ۱ — از طریق Git (توصیه‌شده)**

```bash
git init
git add .
git commit -m "BambooDrop site"
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

سپس در [vercel.com](https://vercel.com) → **Add New → Project** → همان ریپو را انتخاب کن.
فریم‌ورک: **Other** — همه‌چیز خودکار است (`vercel.json` آماده است).

**روش ۲ — کلیک مستقیم (بدون گیت)**

```bash
npm i -g vercel
vercel            # پروژه جدید
vercel --prod     # دیپلوی روی پروداکشن
```

پس از دیپلوی، دامنه‌ای مثل `bamboodrop-xyz.vercel.app` می‌گیری.

## متغیرهای محیطی

| متغیر | توضیح | پیش‌فرض |
|---|---|---|
| `CHANNEL` | نام کانال تلگرام | `Bamboodrop` |
| `GROUP` | نام گروه | `Bamboodropgroup` |
| `PAGES` | چند صفحه از آرشیو خوانده شود (هر صفحه ~۲۰ پست) | `6` |
| `UPSTASH_REDIS_REST_URL` | آدرس Upstash Redis | — |
| `UPSTASH_REDIS_REST_TOKEN` | توکن Upstash | — |

### آرشیو کانال

صفحه‌ی عمومی `t.me/s/<channel>` فقط ~۲۰ پست آخر را نشان می‌دهد.
`lib/telegram.js` با پارامتر `?before=<oldest_post_id>` صفحه‌به‌صفحه به عقب می‌رود
و همه را جمع می‌کند. با `PAGES=6` حدود **۱۲۰ پست** خوانده می‌شود.

افزایش `PAGES` عمق آرشیو را بیشتر می‌کند ولی زمان پاسخ بالا می‌رود
(هر صفحه یک درخواست جدا). حداکثر مجاز ۱۲ است.

### فعال‌سازی ثبت‌نام ایمیل

۱. در [console.upstash.com](https://console.upstash.com) یک دیتابیس Redis رایگان بساز
۲. **REST URL** و **REST TOKEN** را کپی کن
۳. در Vercel → **Settings → Environment Variables** اضافه کن:

```
UPSTASH_REDIS_REST_URL  =  https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN =  xxxx...
```

۴. بدون این متغیرها، فرم پیام «ثبت‌نام فعال نشده» می‌دهد و چیزی ذخیره نمی‌شود.

برای تست محلی، `.env` بساز (در `.gitignore` و `.vercelignore` هست):

```
UPSTASH_REDIS_REST_URL=http://localhost:9099
UPSTASH_REDIS_REST_TOKEN=test
```

### تست

```bash
node mock-upstash.js          # سرور تقلیدی Upstash
node server.js                # در ترمینال دیگر
node test-subscribe.js        # ۹ تست
```

## ساختار

```
public/            فایل‌های استاتیک (آنچه Vercel سرو می‌کند)
  index.html
  style.css
  script.js
  stickers/        ۱۲ استیکر پک بامبو دراپ
lib/telegram.js    پارس کانال، طبقه‌بندی ایردراپ
lib/store.js       ذخیره ایمیل در Redis
lib/env.js         خواندن .env
api/all.js         /api/all
api/stats.js       /api/stats
api/drops.js       /api/drops
api/posts.js       /api/posts
api/subscribe.js   /api/subscribe (POST ثبت، GET تعداد)
server.js          سرور توسعه‌ی محلی
mock-upstash.js    سرور تقلیدی Redis برای تست
test-subscribe.js  تست‌های ثبت‌نام
```

## API

| مسیر | توضیح |
|---|---|
| `/api/all` | آمار + پیام‌ها + ایردراپ‌ها |
| `/api/stats` | فقط آمار |
| `/api/drops` | فقط کارت ایردراپ‌ها |
| `/api/posts?limit=20` | آخرین پیام‌ها |

همه با `Cache-Control: s-maxage=120, stale-while-revalidate=600` کش می‌شوند
تا درخواست‌ها به تلگرام محدود بماند.

## نکته مهم

داده‌ها از **پیش‌نمایش عمومی** تلگرام (`t.me/s/<channel>`) خوانده می‌شوند،
نه از API رسمی. یعنی:
- تا وقتی کانال عمومی باشد کار می‌کند
- اگر کانال خصوصی شود یا تلگرام ساختار HTML را عوض کند، می‌شکند
- در آن صورت باید از Telegram Bot API با توکن استفاده کنی
