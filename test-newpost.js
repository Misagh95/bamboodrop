/** تست: آیا پست جدید خودکار به کارت پروژه‌اش اضافه می‌شود؟ */
import { getData } from './lib/telegram.js';

const d = await getData();
const arc = d.projects.find(p => p.slug === 'arc');

console.log('واقعیت فعلی #arc:');
console.log('  posts :', arc.count);
console.log('  latest:', arc.latest);
console.log('  top   :', arc.posts[0].text.replace(/\s+/g, ' ').slice(0, 50));
console.log('  order : posts[0] تازه‌ترین است؟',
  new Date(arc.posts[0].date) >= new Date(arc.posts[1].date) ? 'بله ✓' : 'نه ✗');

const sorted = d.projects.slice(0, 5);
console.log('\n۵ پروژه‌ی اول (مرتب‌سازی):');
for (const p of sorted) {
  console.log(`  #${p.tag.padEnd(10)} posts=${String(p.count).padStart(3)} drops=${p.drops}`);
}
