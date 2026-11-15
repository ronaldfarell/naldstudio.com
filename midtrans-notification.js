import { json, sb, sha512 } from '../_lib/server.js';

// Daftarkan URL ini di Midtrans Dashboard > Settings > Payment > Notification URL
export async function onRequestPost({ request, env }) {
  let n;
  try { n = await request.json(); } catch { return json({ error: 'bad request' }, 400); }
  const { order_id, status_code, gross_amount, signature_key, transaction_status, fraud_status, payment_type, transaction_id } = n || {};
  if (!order_id || !signature_key) return json({ error: 'bad request' }, 400);

  const expected = await sha512(`${order_id}${status_code}${gross_amount}${env.MIDTRANS_SERVER_KEY}`);
  if (expected !== signature_key) return json({ error: 'invalid signature' }, 403);

  const q = await sb(env, `orders?order_id=eq.${encodeURIComponent(order_id)}&select=status,gross_amount`);
  const rows = q.ok ? await q.json() : [];
  if (!rows.length) return json({ ok: true }); // order tak dikenal (mis. tes dari dashboard): balas 200 agar tidak di-retry
  const row = rows[0];
  if (Math.round(Number(gross_amount)) !== Number(row.gross_amount)) return json({ error: 'amount mismatch' }, 400);

  let status = 'pending';
  if (transaction_status === 'settlement' || (transaction_status === 'capture' && fraud_status !== 'challenge')) status = 'paid';
  else if (transaction_status === 'deny' || transaction_status === 'cancel') status = 'failed';
  else if (transaction_status === 'expire') status = 'expired';
  else if (['refund', 'partial_refund', 'chargeback', 'partial_chargeback'].includes(transaction_status)) status = 'refunded';

  // jangan turunkan pesanan yang sudah lunas karena notifikasi lama/terlambat
  if (row.status === 'paid' && ['pending', 'failed', 'expired'].includes(status)) return json({ ok: true });

  const patch = { status, payment_type: payment_type || null, transaction_id: transaction_id || null, updated_at: new Date().toISOString() };
  if (status === 'paid' && row.status !== 'paid') patch.paid_at = new Date().toISOString();
  const u = await sb(env, `orders?order_id=eq.${encodeURIComponent(order_id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
  if (!u.ok) { console.error('supabase update', u.status, await u.text()); return json({ error: 'db error' }, 500); } // 5xx => Midtrans akan retry
  return json({ ok: true });
}
