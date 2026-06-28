-- Money rails for on-chain $DEAD actions (deposit / withdraw / tradeSale).
-- Gold and all other in-game resources stay OFF-CHAIN in stash_items.
-- Only money-significant flows touch the chain, and every on-chain action is
-- double-recorded in settlements (tx_sig unique) + economy_ledger.
--
-- These tables are additive; settlements/economy_ledger already exist.

-- Withdrawal intents. We NEVER auto-sign payouts: a server-signed payout needs a
-- hot wallet and stays disabled. Each request is recorded for MANUAL review.
create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  wallet text not null,                       -- destination Solana pubkey
  dead_amount numeric not null default 0,     -- requested $DEAD (uiAmount)
  status text not null default 'requested'    -- requested | approved | paid | rejected
    check (status in ('requested', 'approved', 'paid', 'rejected')),
  payout_tx_sig text,                         -- filled in by a human after a manual payout
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists withdrawals_profile_idx on public.withdrawals(profile_id);
create index if not exists withdrawals_status_idx on public.withdrawals(status);

-- Marketplace listings. A sale is settled in $DEAD between two players; the edge
-- function verifies the on-chain transfer to the treasury, then transfers item
-- ownership in stash_items (off-chain) and double-records the settlement.
create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  item text not null,
  qty bigint not null default 1 check (qty > 0),
  price_dead numeric not null default 0,      -- asking price in $DEAD (uiAmount)
  status text not null default 'active'        -- active | sold | cancelled
    check (status in ('active', 'sold', 'cancelled')),
  buyer_id uuid references public.profiles(id) on delete set null,
  tx_sig text,                                -- settlement signature once sold
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketplace_listings_status_idx on public.marketplace_listings(status);
create index if not exists marketplace_listings_seller_idx on public.marketplace_listings(seller_id);

-- All writes go through the account edge function under the service role.
alter table public.withdrawals enable row level security;
alter table public.marketplace_listings enable row level security;
revoke all on public.withdrawals from anon, authenticated;
revoke all on public.marketplace_listings from anon, authenticated;
