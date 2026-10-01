import { getData } from '../lib/telegram.js';

export const config = { runtime: 'nodejs', maxDuration: 10 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600');
  const d = await getData();
  const limit = Math.min(Number(req.query?.limit || 20), 50);
  res.status(200).json({ updatedAt: d.updatedAt, posts: d.posts.slice(0, limit), projects: d.projects, stale: d.stale });
}
