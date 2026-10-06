-- Easy Select Database
-- File name: supabase.sql

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text default 'member',
  activation_status boolean default false,
  total_earnings numeric default 0,
  available_balance numeric default 0,
  pending_balance numeric default 0,
  created_at timestamptz default now()
);

create table if not exists public.products (
  id bigint generated always as identity primary key,
  name text not null,
  link text,
  commission numeric default 0,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.activation_requests (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  amount numeric default 500,
  reference text,
  status text default 'pending',
  created_at timestamptz default now()
);

create table if not exists public.withdrawal_requests (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  amount numeric default 0,
  bkash_number text,
  status text default 'pending',
  created_at timestamptz default now()
);

create table if not exists public.earnings_ledger (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  amount numeric default 0,
  type text,
  note text,
  created_at timestamptz default now()
);

create table if not exists public.lead_tasks (
  id bigint generated always as identity primary key,
  title text not null,
  description text,
  commission numeric default 0,
  active boolean default true,
  created_at timestamptz default now()
);
