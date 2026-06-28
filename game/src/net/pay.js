// pay.js — on-chain $DEAD payments (mainnet, NON-CUSTODIAL).
// The player's own wallet builds + signs + sends an SPL transfer of $DEAD to the
// treasury; we then hand the confirmed signature to the edge fn, which re-verifies
// it on-chain and credits in-game Gold. We never touch a private key or hold funds.
import { RUNTIME } from '../config/runtime.js';
import { Wallet } from './wallet.js';
import { Account } from './account.js';

function provider() { return window.phantom?.solana || window.solana; }

// Send `uiAmount` of $DEAD from the connected wallet to the treasury. Returns the
// confirmed transaction signature.
async function sendDead(uiAmount) {
  if (!RUNTIME.deadMint || !RUNTIME.treasury) throw new Error('$DEAD store not configured yet');
  if (!Wallet.pubkey) throw new Error('connect wallet first');
  const web3 = await import('https://esm.sh/@solana/web3.js@1.95.3');
  const spl = await import('https://esm.sh/@solana/spl-token@0.4.8?deps=@solana/web3.js@1.95.3');
  const { Connection, PublicKey, Transaction } = web3;

  const conn = new Connection(RUNTIME.solanaRpc, 'confirmed');
  const owner = new PublicKey(Wallet.pubkey);
  const mint = new PublicKey(RUNTIME.deadMint);
  const treasury = new PublicKey(RUNTIME.treasury);

  const mintInfo = await spl.getMint(conn, mint);
  const amount = BigInt(Math.round(uiAmount * 10 ** mintInfo.decimals));

  const fromAta = await spl.getAssociatedTokenAddress(mint, owner);
  const toAta = await spl.getAssociatedTokenAddress(mint, treasury);

  const ixs = [];
  if (!(await conn.getAccountInfo(toAta))) {
    // payer creates the treasury's $DEAD account if it doesn't exist yet
    ixs.push(spl.createAssociatedTokenAccountInstruction(owner, toAta, treasury, mint));
  }
  ixs.push(spl.createTransferInstruction(fromAta, toAta, owner, amount));

  const tx = new Transaction().add(...ixs);
  tx.feePayer = owner;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;

  const { signature } = await provider().signAndSendTransaction(tx);
  await conn.confirmTransaction(signature, 'confirmed');
  return signature;
}

// Direct edge-function call for money rails not yet wrapped in account.js. Uses the
// same token-gated transport: anon key satisfies the gateway, the HMAC session
// token is the real auth. Never sends a private key — the wallet signs on-chain.
async function settle(action, payload = {}) {
  if (!Account.isLoggedIn()) throw new Error('connect wallet first');
  const res = await fetch(`${RUNTIME.supabaseUrl}/functions/v1/account`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: RUNTIME.supabaseAnonKey,
      Authorization: `Bearer ${RUNTIME.supabaseAnonKey}`,
    },
    body: JSON.stringify({ action, token: Account.token, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `account ${action} failed (${res.status})`);
  return data;
}

export const Pay = {
  configured() { return !!(RUNTIME.deadMint && RUNTIME.treasury); },
  quoteGold(deadAmount) { return Math.floor(deadAmount * (RUNTIME.goldPerDead || 0)); },

  // Buy in-game Gold with $DEAD. Sends the payment, then settles it server-side.
  async buyGoldWithDead(deadAmount) {
    if (!Account.isLoggedIn()) throw new Error('connect wallet first');
    const sig = await sendDead(deadAmount);
    return Account.buyGold(sig); // { credited, deadAmount, stash }
  },

  // Deposit $DEAD to the treasury and record it on-chain + in the DB. The wallet
  // signs/sends the SPL transfer; the edge fn re-verifies the sig before booking.
  async depositDead(deadAmount) {
    if (!Account.isLoggedIn()) throw new Error('connect wallet first');
    const sig = await sendDead(deadAmount);
    return settle('deposit', { txSig: sig }); // { ok, deadAmount }
  },

  // Request a $DEAD withdrawal. REQUEST ONLY — payouts are never auto-signed; the
  // edge fn records an intent row flagged for manual review. `wallet` defaults to
  // the connected wallet server-side. Returns { ok, requestId, status, manualReview }.
  async requestWithdraw(deadAmount, wallet) {
    if (!Account.isLoggedIn()) throw new Error('connect wallet first');
    const payload = { deadAmount };
    if (wallet) payload.wallet = wallet;
    return settle('withdraw', payload);
  },

  // Buy a marketplace listing: pay the seller's price in $DEAD to the treasury,
  // then the edge fn verifies the tx and transfers item ownership in the DB.
  async buyListing(listingId, priceDead) {
    if (!Account.isLoggedIn()) throw new Error('connect wallet first');
    const sig = await sendDead(priceDead);
    return settle('tradeSale', { listingId, txSig: sig }); // { ok, item, qty, stash }
  },
};
