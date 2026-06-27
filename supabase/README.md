# Deadwire — Supabase backend

Project ref: `dfwzakgibutalkqyuwbj` · URL: https://dfwzakgibutalkqyuwbj.supabase.co

## Schema
Wallet-identity accounts and economy. Applied via migrations:
- `profiles` (wallet pubkey = identity), `stash_items`, `runs`, `economy_ledger`,
  `base_modules`, `sectors`, `auth_nonces`.
- **RLS** is enabled on every table. Anon gets read-only on `profiles` (leaderboard)
  and `sectors` (war map) only; all other tables deny anon. **All writes go through
  the `account` edge function under the service role**, never directly from the client.
- `leaderboard` view is `security_invoker` so it honors RLS.

## Edge function: `account` (`functions/account/index.ts`)
Non-custodial wallet auth + gated persistence. Flow:
1. `nonce {wallet}` → returns a one-time message to sign.
2. `login {wallet, nonce, signature}` → verifies the ed25519 signature (tweetnacl),
   upserts the profile, returns a short-lived HMAC session token + the cloud stash.
3. `save {token, stash}` / `applyRun {token, run}` → token-gated writes.

The HMAC session token is signed with the service-role key (already a secret env var
inside the function). We never hold a wallet private key; players sign in their own
wallet. Deployed with `verify_jwt = false` because it does its own auth.

Redeploy (MCP or CLI):
```
supabase functions deploy account --project-ref dfwzakgibutalkqyuwbj --no-verify-jwt
```
