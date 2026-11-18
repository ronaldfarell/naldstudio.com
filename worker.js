import { onRequestPost as checkout } from './functions/api/checkout.js';
import { onRequestPost as notification } from './functions/api/midtrans-notification.js';
import { onRequestGet as orderStatus } from './functions/api/order-status.js';
import { ALLOWED_ORIGINS } from './functions/_lib/server.js';

const notAllowed = () => new Response('Method Not Allowed', { status: 405 });

function withCors(request, res) {
  const o = request.headers.get('Origin');
  if (!o || !ALLOWED_ORIGINS.includes(o)) return res;
  const h = new Headers(res.headers);
  h.set('Access-Control-Allow-Origin', o);
  h.set('Vary', 'Origin');
  return new Response(res.body, { status: res.status, headers: h });
}

async function api(request, env, url) {
  const ctx = { request, env };
  const m = request.method;
  if (url.pathname === '/api/checkout') return m === 'POST' ? checkout(ctx) : notAllowed();
  if (url.pathname === '/api/midtrans-notification') return m === 'POST' ? notification(ctx) : notAllowed();
  if (url.pathname === '/api/order-status') return m === 'GET' ? orderStatus(ctx) : notAllowed();
  return new Response('Not found', { status: 404 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      if (request.method === 'OPTIONS') {
        return withCors(request, new Response(null, { status: 204, headers: {
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400'
        } }));
      }
      return withCors(request, await api(request, env, url));
    }

    // /products dan /services membuka index.html (tampilan dipilih oleh router di halaman)
    if (['/products', '/products.html', '/services', '/services.html'].includes(url.pathname)) {
      const res = await env.ASSETS.fetch(new Request(new URL('/', url), request));
      return new Response(res.body, { status: 200, headers: res.headers });
    }
    return env.ASSETS.fetch(request);
  }
};
