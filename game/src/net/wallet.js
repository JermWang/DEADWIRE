// wallet.js — NON-CUSTODIAL Solana wallet connect (Phantom et al.), MAINNET.
// We only ever read the public key and ask the wallet to sign a message. We never
// see, request, or store a private key. Players hold their own bag.
import bs58 from 'https://esm.sh/bs58@5.0.0';
import { RUNTIME } from '../config/runtime.js';

function provider() {
  // Phantom (and most wallets) inject here. window.solana is the legacy alias.
  const p = window.phantom?.solana || window.solana;
  return p?.isPhantom || p?.isConnected !== undefined ? p : p || null;
}

export const Wallet = {
  available() { return !!provider(); },
  cluster() { return RUNTIME.solanaCluster; },
  pubkey: null,

  installHint() {
    return 'No Solana wallet found. Install Phantom (phantom.app) to connect on mainnet.';
  },

  // Connect + return base58 public key. Throws if no wallet / user rejects.
  async connect() {
    const p = provider();
    if (!p) throw new Error(this.installHint());
    const res = await p.connect();
    this.pubkey = (res?.publicKey || p.publicKey)?.toString();
    if (!this.pubkey) throw new Error('Wallet returned no public key');
    return this.pubkey;
  },

  async disconnect() {
    try { await provider()?.disconnect?.(); } catch { /* noop */ }
    this.pubkey = null;
  },

  // Sign a UTF-8 message; returns the signature as base58 (what the edge fn verifies).
  async signMessage(message) {
    const p = provider();
    if (!p) throw new Error(this.installHint());
    const enc = new TextEncoder().encode(message);
    const out = await p.signMessage(enc, 'utf8');
    const sig = out?.signature || out;
    return bs58.encode(sig instanceof Uint8Array ? sig : new Uint8Array(sig));
  },
};
