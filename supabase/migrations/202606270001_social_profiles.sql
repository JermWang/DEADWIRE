-- Unified Discord/Solana profiles and bidirectional in-game friendships.
alter table public.profiles alter column wallet drop not null;
alter table public.profiles add column if not exists discord_id text unique;
alter table public.profiles add column if not exists avatar_url text not null default '';
alter table public.profiles add column if not exists title text not null default 'YARD ROOKIE';
alter table public.profiles add column if not exists discord_contacts jsonb not null default '[]'::jsonb;

create unique index if not exists profiles_handle_lower_unique
  on public.profiles (lower(handle));

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_not_self check (requester_id <> addressee_id),
  constraint friendships_direction_unique unique (requester_id, addressee_id)
);

create index if not exists friendships_requester_idx on public.friendships(requester_id);
create index if not exists friendships_addressee_idx on public.friendships(addressee_id);

alter table public.friendships enable row level security;
revoke all on public.friendships from anon, authenticated;

-- Edge functions use the service role. Public clients only see the curated
-- profile fields returned by the account function.
