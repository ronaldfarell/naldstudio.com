import { json, sb } from '../_lib/server.js';

export async function onRequestGet({ request, env }) {
  const id = new URL(request.url).searchParams.get('order_id') || '';
  if (!/^NALD-[A-Z0-9-]{6,40}$/.test(id)) return json({ error: 'not found' }, 404);
  const r = await sb(env, `orders?order_id=eq.${id}&select=status`);
  const rows = r.ok ? await r.json() : [];
  return rows.length ? json({ status: rows[0].status }) : json({ error: 'not found' }, 404);
}
