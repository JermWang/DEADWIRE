# Deadwire — Supabase backend

Project ref: `dfwzakgibutalkqyuwbj` · URL: https://dfwzakgibutalkqyuwbj.supabase.co

## Schema
Unified Discord/Solana accounts, social graph, and economy. Applied via migrations:
- `profiles` (wallet pubkey = identity), `stash_items`, `runs`, `economy_ledger`,
  `base_modules`, `sectors`, `auth_nonces`.
- `friendships` stores pending and accepted in-game friendships. Profiles can be
  identified by a wallet, Discord account, or both.
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

Discord sign-in uses `discordLogin {accessToken, providerToken}` to verify the
Supabase session and create or restore the same Deadwire profile. `profilesSearch`,
`friendsList`, `friendRequest`, `friendRespond`, and `friendRemove` power the
lobby Friends page.

## Discord OAuth setup

1. Create a Discord application and OAuth client.
2. Add the Supabase callback URL shown under Authentication > Providers > Discord
   to the Discord application's OAuth redirects.
3. Enable Discord in Supabase Authentication with that client ID and secret.
4. Add the production game URL and local preview URL to the Supabase redirect
   allow list.
5. Request/approve `relationships.read` for Discord-friend import. Login and
   in-game username search still work when Discord does not grant that scope.

Apply `migrations/202606270001_social_profiles.sql` before deploying this function.

The HMAC session token is signed with the service-role key (already a secret env var
inside the function). We never hold a wallet private key; players sign in their own
wallet. Deployed with `verify_jwt = false` because it does its own auth.

Redeploy (MCP or CLI):
```
supabase functions deploy account --project-ref dfwzakgibutalkqyuwbj --no-verify-jwt
```
