-- Deadwire base schema: accounts, stash, runs, economy, war map, on-chain settlement.
-- Recovered into the repo when the backend was re-provisioned onto an egress-unrestricted
-- Supabase org (project ref gdclhpuakkcatzmzxysd). All writes go through the `account`
-- edge function (service role). Anon is read-only on profiles (leaderboard) + sectors
-- (war map) only. Runs BEFORE 202606270001_social_profiles.sql.

create extension if not exists pgcrypto;

-- Accounts. wallet = Solana pubkey identity (social migration makes it nullable +
-- adds discord identity columns). handle = in-game username.
create table if not exists public.profiles (
  id           uuid primary key default gen_random_uuid(),
  wallet       text unique not null,
  handle       text,
  xp           integer not null default 0,
  level        integer not null default 1,
  runs         integer not null default 0,
  extractions  integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Per-profile item counts (Gold, Scrap, Ammo, ...). Upserted by (profile_id,item).
create table if not exists public.stash_items (
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  item        text not null,
  qty         bigint not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (profile_id, item)
);

-- Raid history.
create table if not exists public.runs (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  extracted   boolean not null default false,
  loot        jsonb not null default '[]'::jsonb,
  xp          integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Append-only currency ledger. (withdraw_reconcile migration re-adds the currency
-- check to include 'DEAD'.)
create table if not exists public.economy_ledger (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  currency    text not null,
  delta       numeric not null default 0,
  reason      text,
  tx_sig      text,
  created_at  timestamptz not null default now(),
  constraint economy_ledger_currency_check
    check (currency in ('GOLD','AMMO','SCRAP','COMPONENTS','PARTS','MED','CORE_SHARD','CORE','DEAD'))
);
create index if not exists economy_ledger_profile_idx on public.economy_ledger(profile_id);

-- Base-as-engine modules (persistent per-profile base upgrades).
create table if not exists public.base_modules (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  module      text not null,
  level       integer not null default 1,
  updated_at  timestamptz not null default now(),
  unique (profile_id, module)
);

-- War-map sectors. Anon read-only. Client reads district/owner_profile_id/captured_at
-- filtered by server_id.
create table if not exists public.sectors (
  server_id         text not null default 'mainnet-1',
  district          text not null,
  owner_profile_id  uuid references public.profiles(id) on delete set null,
  captured_at       timestamptz,
  risk_tier         integer not null default 1,
  updated_at        timestamptz not null default now(),
  primary key (server_id, district)
);

-- One-time sign-in nonces (ed25519 challenge).
create table if not exists public.auth_nonces (
  id          uuid primary key default gen_random_uuid(),
  nonce       text not null unique,
  wallet      text not null,
  used        boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Server config read by the edge function (dead_mint, treasury, gold_per_dead, solana_rpc).
-- SECRETS (service role key, RPC api keys) are NEVER stored here.
create table if not exists public.app_config (
  key    text primary key,
  value  text
);

-- On-chain settlement idempotency + audit (tx_sig unique).
create table if not exists public.settlements (
  id           uuid primary key default gen_random_uuid(),
  tx_sig       text not null unique,
  profile_id   uuid references public.profiles(id) on delete set null,
  wallet       text,
  kind         text not null,
  dead_amount  numeric not null default 0,
  gold_amount  bigint,
  sku          text,
  created_at   timestamptz not null default now()
);

-- Public leaderboard view (security_invoker so anon RLS on profiles applies).
create or replace view public.leaderboard
  with (security_invoker = true) as
  select id, handle, level, xp, runs, extractions, wallet
  from public.profiles
  order by extractions desc, level desc, xp desc;

-- RLS: on for every table. Anon may read profiles + sectors only; all writes are
-- service-role via the edge function.
alter table public.profiles          enable row level security;
alter table public.stash_items       enable row level security;
alter table public.runs              enable row level security;
alter table public.economy_ledger    enable row level security;
alter table public.base_modules      enable row level security;
alter table public.sectors           enable row level security;
alter table public.auth_nonces       enable row level security;
alter table public.app_config        enable row level security;
alter table public.settlements       enable row level security;

revoke all on public.stash_items, public.runs, public.economy_ledger,
  public.base_modules, public.auth_nonces, public.app_config, public.settlements
  from anon, authenticated;

drop policy if exists profiles_anon_read on public.profiles;
create policy profiles_anon_read on public.profiles for select to anon, authenticated using (true);

drop policy if exists sectors_anon_read on public.sectors;
create policy sectors_anon_read on public.sectors for select to anon, authenticated using (true);

grant select on public.profiles, public.sectors, public.leaderboard to anon, authenticated;

-- Seed config (treasury empty => money rails stay 503 until launch; no secrets here).
insert into public.app_config(key, value) values
  ('dead_mint', 'nVE4EY5Q5ByPjsNAFuCr2iMC7Gpu2pgrTStx4MNpump'),
  ('treasury', ''),
  ('gold_per_dead', '1000')
on conflict (key) do nothing;

-- Seed war-map districts for the default server.
insert into public.sectors(server_id, district, risk_tier) values
  ('mainnet-1','Breaker Yard',1),
  ('mainnet-1','Scrap Flats',1),
  ('mainnet-1','Coolant Run',2),
  ('mainnet-1','The Gantry',2),
  ('mainnet-1','Rail Spur',2),
  ('mainnet-1','Slag Pits',3),
  ('mainnet-1','Overwatch Ridge',3),
  ('mainnet-1','Reactor Core',4)
on conflict (server_id, district) do nothing;
