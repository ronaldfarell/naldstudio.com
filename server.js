export const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const isProd = (env) => String(env.MIDTRANS_IS_PRODUCTION).toLowerCase() === 'true';
export const snapHost = (env) => (isProd(env) ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com');

// Supabase REST dengan service key (hanya di server, jangan pernah ke browser)
export function sb(env, path, init = {}) {
  const k = env.SUPABASE_SERVICE_KEY;
  const h = { apikey: k, 'Content-Type': 'application/json', ...(init.headers || {}) };
  if (k.startsWith('eyJ')) h.Authorization = `Bearer ${k}`; // key lama (JWT); key baru sb_secret_ cukup apikey
  return fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${path}`, { ...init, headers: h });
}

export async function sha512(str) {
  const buf = await crypto.subtle.digest('SHA-512', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Website yang boleh memanggil API ini dari domain lain (GitHub Pages)
export const ALLOWED_ORIGINS = ['https://naldstudio.com', 'https://www.naldstudio.com'];
