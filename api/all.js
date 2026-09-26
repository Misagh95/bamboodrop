import { getData } from '../lib/telegram.js';

export const config = { runtime: 'nodejs', maxDuration: 10 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  // کش در لبه‌ی Vercel تا هر درخواست به تلگرام نرود
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600');
  const d = await getData();
  res.status(200).json({
    updatedAt: d.updatedAt, channel: d.channel, group: d.group,
    stats: d.stats, posts: d.posts, drops: d.drops, stale: d.stale
  });
}
