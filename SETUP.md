# Setup Midtrans di naldstudio.com

## 1. Struktur repo (root repo = root Cloudflare Pages)
```
index.html  products.json  _redirects  supabase.sql
functions/api/checkout.js
functions/api/midtrans-notification.js
functions/api/order-status.js
functions/_lib/server.js
```
(assets/ tetap seperti sekarang)

## 2. Supabase
SQL Editor -> tempel isi `supabase.sql` -> Run. Tabel `orders` terkunci (RLS), hanya server yang bisa akses.

## 3. Cloudflare Pages -> Settings -> Variables and Secrets
| Nama | Isi | Jenis |
|---|---|---|
| MIDTRANS_SERVER_KEY | Server Key Midtrans | Secret |
| MIDTRANS_CLIENT_KEY | Client Key Midtrans | Plaintext |
| MIDTRANS_IS_PRODUCTION | `false` (sandbox) / `true` (live) | Plaintext |
| SUPABASE_URL | https://xxxx.supabase.co | Plaintext |
| SUPABASE_SERVICE_KEY | service_role / secret key (BUKAN anon key) | Secret |

Setelah isi variabel, deploy ulang.

## 4. Midtrans Dashboard (Settings -> Payment -> Notification URL)
`https://www.naldstudio.com/api/midtrans-notification`
(pakai host yang sama dengan yang dibuka pelanggan, www atau tanpa www)

## 5. Urutan uji
1. Pakai key SANDBOX dulu, `MIDTRANS_IS_PRODUCTION=false`. Beli 1 produk, bayar dengan simulator Midtrans.
2. Cek tabel `orders` di Supabase: status berubah `pending` -> `paid`.
3. Baru ganti ke key PRODUCTION + `true`, deploy ulang, lalu ajukan ulang ke Midtrans.

## 6. Ubah harga
Edit `products.json` saja (harga dalam rupiah, tanpa titik). Server memakai file yang sama untuk menghitung total, jadi harga dari browser tidak bisa dimanipulasi.
