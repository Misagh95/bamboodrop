/**
 * اسکریپت build برای Vercel.
 * چون outputDirectory روی "public" تنظیم شده، Vercel فقط فایل‌های
 * داخل آن را سرو می‌کند. پس Serverless Function ها را به public/api
 * کپی می‌کنیم تا در خروجی build هم باشند.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const apiSrc = path.join(root, 'api');
const libSrc = path.join(root, 'lib');
const apiOut = path.join(root, 'public', 'api');
const libOut = path.join(root, 'public', 'lib');

const copyDir = (from, to) => {
  if (!fs.existsSync(from)) return 0;
  fs.mkdirSync(to, { recursive: true });
  let n = 0;
  for (const f of fs.readdirSync(from)) {
    if (f.endsWith('.test.js')) continue;
    fs.copyFileSync(path.join(from, f), path.join(to, f));
    n++;
  }
  return n;
};

const a = copyDir(apiSrc, apiOut);
const l = copyDir(libSrc, libOut);

console.log(`build: ${a} api file(s) → public/api, ${l} lib file(s) → public/lib`);

// بررسی سلامت خروجی
const required = ['index.html', 'style.css', 'script.js'];
const missing = required.filter(f => !fs.existsSync(path.join(root, 'public', f)));
if (missing.length) {
  console.error('build FAILED — missing in public/: ' + missing.join(', '));
  process.exit(1);
}
console.log('build: OK');
