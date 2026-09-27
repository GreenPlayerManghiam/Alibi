-- SpendPulse: Supabase schema + seed data
-- Run in the Supabase SQL editor.

create extension if not exists "pgcrypto";

-- 1. PROFILES ---------------------------------------------------------------
-- In production, add: references auth.users(id) on delete cascade
-- (left off here so the demo seed user works without an auth account).
create table if not exists public.profiles (
  user_id           uuid primary key,
  monthly_allowance numeric(10,2) not null check (monthly_allowance >= 0),
  fixed_mess_fees   numeric(10,2) not null default 0 check (fixed_mess_fees >= 0),
  remaining_days    int           not null check (remaining_days between 0 and 31),
  created_at        timestamptz   not null default now()
);

-- 2. TRANSACTIONS -----------------------------------------------------------
create table if not exists public.transactions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(user_id) on delete cascade,
  amount     numeric(10,2) not null check (amount > 0),
  category   text not null check (category in ('Food','Travel','Social','Academic','Income')),
  merchant   text,
  raw_text   text,
  type       text not null check (type in ('expense','income')),
  created_at timestamptz not null default now()
);

create index if not exists transactions_user_created_idx
  on public.transactions (user_id, created_at desc);

-- 3. ROW LEVEL SECURITY -----------------------------------------------------
alter table public.profiles     enable row level security;
alter table public.transactions enable row level security;

create policy "own profile"      on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own transactions" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4. SEED DATA (demo student) -----------------------------------------------
insert into public.profiles (user_id, monthly_allowance, fixed_mess_fees, remaining_days)
values ('11111111-1111-1111-1111-111111111111', 10000, 3000, 18)
on conflict (user_id) do nothing;

insert into public.transactions (user_id, amount, category, merchant, raw_text, type, created_at) values
  ('11111111-1111-1111-1111-111111111111', 180, 'Food',     'Canteen momos',       '180 canteen momos',         'expense', now() - interval '1 hour'),
  ('11111111-1111-1111-1111-111111111111',  50, 'Travel',   'Auto',                'auto 50 to main gate',      'expense', now() - interval '5 hours'),
  ('11111111-1111-1111-1111-111111111111', 120, 'Food',     'Campus cafe',         'coffee 120',                'expense', now() - interval '1 day'),
  ('11111111-1111-1111-1111-111111111111', 250, 'Social',   'Birthday cake split', 'cake split for Aman 250',   'expense', now() - interval '2 days'),
  ('11111111-1111-1111-1111-111111111111',  90, 'Academic', 'Xerox shop',          'notes xerox 90',            'expense', now() - interval '3 days'),
  ('11111111-1111-1111-1111-111111111111', 500, 'Income',   'Home (UPI)',          'mom sent 500 for books',    'income',  now() - interval '4 days');
