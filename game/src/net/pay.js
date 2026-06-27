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

export const Pay = {
  configured() { return !!(RUNTIME.deadMint && RUNTIME.treasury); },
  quoteGold(deadAmount) { return Math.floor(deadAmount * (RUNTIME.goldPerDead || 0)); },

  // Buy in-game Gold with $DEAD. Sends the payment, then settles it server-side.
  async buyGoldWithDead(deadAmount) {
    if (!Account.isLoggedIn()) throw new Error('connect wallet first');
    const sig = await sendDead(deadAmount);
    return Account.buyGold(sig); // { credited, deadAmount, stash }
  },
};
