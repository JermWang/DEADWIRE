-- Money-rail integrity, two parts.
-- NOTE: apply this once the Supabase project is un-paused/restored.
--
-- 1) Allow $DEAD in the economy ledger. The money rails (deposit/withdraw/tradeSale)
--    record entries with currency 'DEAD', but the original economy_ledger currency
--    CHECK omitted it — those inserts would fail at launch. Drop whatever currency
--    check exists (by any name) and re-add a permissive one that includes DEAD.
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.economy_ledger'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%currency%'
  loop
    execute format('alter table public.economy_ledger drop constraint %I', c);
  end loop;
end $$;

alter table public.economy_ledger
  add constraint economy_ledger_currency_check
  check (currency in ('GOLD','AMMO','SCRAP','COMPONENTS','PARTS','MED','CORE_SHARD','CORE','DEAD'));

-- 2) Reconcile rejected withdrawals. handleWithdraw books a provisional -$DEAD ledger
--    entry when a withdrawal is requested. If it is later REJECTED (manual review), the
--    debit must be reversed. This trigger auto-inserts the compensating +$DEAD credit.
create or replace function public.reconcile_rejected_withdrawal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'rejected' and old.status is distinct from 'rejected' then
    insert into public.economy_ledger (profile_id, currency, delta, reason)
    values (new.profile_id, 'DEAD', new.dead_amount, 'withdraw_rejected:refund');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reconcile_rejected_withdrawal on public.withdrawals;
create trigger trg_reconcile_rejected_withdrawal
  after update of status on public.withdrawals
  for each row execute function public.reconcile_rejected_withdrawal();

-- This is a trigger-only SECURITY DEFINER function; it must never be callable
-- directly via the PostgREST RPC endpoint. Revoke EXECUTE from the API roles.
revoke all on function public.reconcile_rejected_withdrawal() from anon, authenticated, public;
