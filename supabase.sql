-- Jalankan sekali di Supabase > SQL Editor
create table if not exists public.orders (
  id bigint generated always as identity primary key,
  order_id text unique not null,
  status text not null default 'pending' check (status in ('pending','paid','failed','expired','refunded')),
  gross_amount integer not null,
  items jsonb not null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  address text not null,
  city text not null,
  postal_code text not null,
  note text,
  snap_token text,
  redirect_url text,
  payment_type text,
  transaction_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- RLS aktif TANPA policy = browser (anon key) tidak bisa baca/tulis sama sekali.
-- Hanya server (service key di Cloudflare) yang bisa akses.
alter table public.orders enable row level security;
