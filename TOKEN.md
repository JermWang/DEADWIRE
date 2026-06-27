# $DEAD token + in-game Gold — go-live checklist

Deadwire's economy is dual-currency:
- **$DEAD** — the on-chain hard currency (SPL token, Solana mainnet). Real, tradeable.
- **Gold** — in-game only (tracked in Supabase). Bought with $DEAD. Never on-chain.

Everything in-game is priced in either $DEAD or Gold.

The whole payment rail is already built and wired (client `pay.js` → edge fn `buyGold`
→ on-chain verification → Gold credit, idempotent per tx). It's just **disabled until
the $DEAD mint exists and the config is filled in.** Those last steps need YOUR keypair
and SOL, so they're listed here for you to run — Claude won't touch your keys or funds.

## 1. Create the $DEAD mint (your wallet, your SOL — ~0.01–0.02 SOL)
Using the Solana + SPL Token CLIs on mainnet:
```bash
solana config set --url https://api.mainnet-beta.solana.com
# fund the keypair you'll use as mint authority / treasury, then:
spl-token create-token --decimals 6            # -> prints the $DEAD MINT ADDRESS
spl-token create-account <MINT>                 # your treasury token account
spl-token mint <MINT> 1000000000                # mint initial supply to yourself
# (optional, recommended once supply is final) lock supply:
spl-token authorize <MINT> mint --disable
```
Pick the **treasury wallet** = the pubkey that should receive $DEAD payments
(can be your main wallet or a dedicated one). It only ever *receives*; non-custodial.

## 2. Tell the game + server about it
Two places, keep them identical:

**Client** — `game/src/config/runtime.js`:
```js
deadMint: '<MINT>',
treasury: '<TREASURY_PUBKEY>',
goldPerDead: 1000,   // tune the exchange rate
```

**Server** — Supabase `app_config` table (source of truth for verification):
```sql
update public.app_config set value = '<MINT>'            where key = 'dead_mint';
update public.app_config set value = '<TREASURY_PUBKEY>' where key = 'treasury';
update public.app_config set value = '1000'              where key = 'gold_per_dead';
-- optional: a paid RPC for reliability
update public.app_config set value = '<HELIUS_OR_QUICKNODE_RPC>' where key = 'solana_rpc';
```
(Just hand Claude the mint + treasury and it'll run these for you.)

## 3. How a purchase flows (already implemented)
```js
import { Pay } from './net/pay.js';
await Pay.buyGoldWithDead(10);   // wallet sends 10 $DEAD -> credits 10*goldPerDead Gold
```
The edge fn re-fetches the tx from mainnet, confirms the $DEAD actually landed in the
treasury, and credits Gold exactly once per signature (replay-safe).

## Still to build (next session, once the mint is live)
- The in-game **Store UI** (buy Gold with $DEAD; buy cosmetics with Gold or $DEAD).
- `purchase` action for spending Gold / $DEAD on items (mirrors `buyGold`).
- Optional: price catalog table so SKUs/prices are data, not code.
