create extension if not exists pgcrypto;

create table if not exists public.demo_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  clinic text not null,
  email text not null,
  phone text not null default '',
  country text not null default '',
  doctor_count text not null,
  locations text not null default '',
  current_system text not null default '',
  goal text not null default '',
  preferred_date text not null default '',
  preferred_time text not null default '',
  message text not null default '',
  status text not null default 'new' check (status in ('new','contacted','demo_scheduled','converted','closed'))
);


alter table public.demo_leads enable row level security;
create index if not exists demo_leads_created_at_idx on public.demo_leads (created_at desc);
