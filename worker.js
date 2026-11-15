import { onRequestPost as checkout } from './functions/api/checkout.js';
import { onRequestPost as notification } from './functions/api/midtrans-notification.js';
import { onRequestGet as orderStatus } from './functions/api/order-status.js';

const notAllowed = () => new Response('Method Not Allowed', { status: 405 });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ctx = { request, env };
    const m = request.method;

    if (url.pathname === '/api/checkout') return m === 'POST' ? checkout(ctx) : notAllowed();
    if (url.pathname === '/api/midtrans-notification') return m === 'POST' ? notification(ctx) : notAllowed();
    if (url.pathname === '/api/order-status') return m === 'GET' ? orderStatus(ctx) : notAllowed();
    if (url.pathname.startsWith('/api/')) return new Response('Not found', { status: 404 });

    // /products dan /services membuka index.html (tampilan dipilih oleh router di halaman)
    if (['/products', '/products.html', '/services', '/services.html'].includes(url.pathname)) {
      const res = await env.ASSETS.fetch(new Request(new URL('/', url), request));
      return new Response(res.body, { status: 200, headers: res.headers });
    }
    return env.ASSETS.fetch(request);
  }
};
