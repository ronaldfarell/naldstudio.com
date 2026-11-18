import { json, sb, isProd, snapHost, ALLOWED_ORIGINS } from '../_lib/server.js';

const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, max);

async function handle({ request, env }) {
  const missing = ['MIDTRANS_SERVER_KEY', 'MIDTRANS_CLIENT_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY'].filter((k) => !env[k]);
  if (missing.length) return json({ error: `Pembayaran belum dikonfigurasi (kurang: ${missing.join(', ')}). Hubungi CS.` }, 500);

  const selfOrigin = new URL(request.url).origin;
  const reqOrigin = request.headers.get('Origin');
  if (reqOrigin && reqOrigin !== selfOrigin && !ALLOWED_ORIGINS.includes(reqOrigin)) return json({ error: 'Forbidden' }, 403);
  const origin = ALLOWED_ORIGINS.includes(reqOrigin) ? reqOrigin : selfOrigin; // halaman tujuan setelah bayar

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Permintaan tidak valid.' }, 400); }

  // --- validasi pelanggan ---
  const c = body.customer || {};
  const cust = { name: clean(c.name, 80), email: clean(c.email, 100), phone: clean(c.phone, 20), address: clean(c.address, 250), city: clean(c.city, 60), postal: clean(c.postal, 5), note: clean(c.note, 200) };
  if (!cust.name || !cust.address || !cust.city) return json({ error: 'Lengkapi nama, alamat, dan kota.' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cust.email)) return json({ error: 'Email tidak valid.' }, 400);
  if (!/^[0-9+ ()-]{8,20}$/.test(cust.phone)) return json({ error: 'Nomor HP tidak valid.' }, 400);
  if (!/^[0-9]{5}$/.test(cust.postal)) return json({ error: 'Kode pos harus 5 angka.' }, 400);

  // --- harga SELALU dari products.json di server, bukan dari browser ---
  const res = await env.ASSETS.fetch(new URL('/products.json', request.url));
  if (!res.ok) return json({ error: 'Katalog tidak tersedia.' }, 500);
  const catalog = await res.json();
  const fee = Math.max(0, Math.round(Number(catalog.shipping_fee) || 0));

  const lines = new Map();
  for (const it of Array.isArray(body.items) ? body.items.slice(0, 20) : []) {
    const qty = Math.floor(Number(it.qty));
    const p = catalog.products.find((x) => x.id === Number(it.id));
    if (!p || !(p.price > 0) || p.stock === false || !(qty >= 1 && qty <= 10)) return json({ error: 'Produk tidak valid atau stok habis.' }, 400);
    lines.set(p.id, { id: String(p.id), name: p.name.slice(0, 50), price: Math.round(p.price), quantity: Math.min(10, (lines.get(p.id)?.quantity || 0) + qty) });
  }
  const items = [...lines.values()];
  if (!items.length) return json({ error: 'Keranjang kosong.' }, 400);
  if (fee > 0) items.push({ id: 'ONGKIR', name: 'Ongkos kirim', price: fee, quantity: 1 });
  const gross = items.reduce((t, i) => t + i.price * i.quantity, 0);

  const rnd = [...crypto.getRandomValues(new Uint8Array(5))].map((b) => b.toString(36).toUpperCase().padStart(2, '0')).join('').slice(0, 8);
  const orderId = `NALD-${Date.now().toString(36).toUpperCase()}-${rnd}`;

  const ins = await sb(env, 'orders', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ order_id: orderId, status: 'pending', gross_amount: gross, items, customer_name: cust.name, customer_email: cust.email, customer_phone: cust.phone, address: cust.address, city: cust.city, postal_code: cust.postal, note: cust.note || null })
  });
  if (!ins.ok) { console.error('supabase insert', ins.status, await ins.text()); return json({ error: `Pesanan gagal disimpan (kode: DB_${ins.status}). Coba lagi atau hubungi CS.` }, 502); }

  const [first, ...rest] = cust.name.split(' ');
  const addr = { first_name: first, last_name: rest.join(' '), phone: cust.phone, address: cust.address, city: cust.city, postal_code: cust.postal, country_code: 'IDN' };
  const mid = await fetch(`${snapHost(env)}/snap/v1/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: 'Basic ' + btoa(env.MIDTRANS_SERVER_KEY + ':') },
    body: JSON.stringify({
      transaction_details: { order_id: orderId, gross_amount: gross },
      item_details: items,
      customer_details: { first_name: first, last_name: rest.join(' '), email: cust.email, phone: cust.phone, billing_address: addr, shipping_address: addr },
      callbacks: { finish: `${origin}/?order=${orderId}` },
      expiry: { unit: 'hours', duration: 24 }
    })
  });
  const raw = await mid.text();
  let m = {};
  try { m = JSON.parse(raw); } catch { /* bukan JSON */ }
  if (!mid.ok || !m.token) {
    console.error('midtrans', mid.status, raw.slice(0, 300));
    await sb(env, `orders?order_id=eq.${orderId}`, { method: 'PATCH', body: JSON.stringify({ status: 'failed' }) });
    const reason = String((m.error_messages && m.error_messages[0]) || m.status_message || m.message || raw || '').replace(/\s+/g, ' ').slice(0, 140);
    return json({ error: `Pembayaran belum bisa dibuat (kode: MIDTRANS_${mid.status}${reason ? ' - ' + reason : ''}). Coba lagi atau hubungi CS.` }, 502);
  }
  await sb(env, `orders?order_id=eq.${orderId}`, { method: 'PATCH', body: JSON.stringify({ snap_token: m.token, redirect_url: m.redirect_url }) });

  return json({ order_id: orderId, token: m.token, redirect_url: m.redirect_url, client_key: env.MIDTRANS_CLIENT_KEY, snap_url: `${snapHost(env)}/snap/snap.js`, production: isProd(env) });
}

export async function onRequestPost(ctx) {
  try { return await handle(ctx); }
  catch (e) {
    console.error('checkout exception', e && e.message);
    return json({ error: `Terjadi kesalahan server (kode: EXC - ${String((e && e.message) || e).slice(0, 60)}). Hubungi CS.` }, 500);
  }
}
