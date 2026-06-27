// supabase.js — read-only anon client for public data (leaderboard, war map).
// All mutations go through the account edge function, never directly from here.
import { RUNTIME } from '../config/runtime.js';

let _client = null;
export async function supabase() {
  if (_client) return _client;
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.45.0');
  _client = createClient(RUNTIME.supabaseUrl, RUNTIME.supabaseAnonKey, { auth: { persistSession: false } });
  return _client;
}

export async function leaderboard(limit = 25) {
  const sb = await supabase();
  const { data, error } = await sb.from('leaderboard').select('*').limit(limit);
  if (error) throw error;
  return data || [];
}

export async function warMap(serverId = 'mainnet-1') {
  const sb = await supabase();
  const { data, error } = await sb.from('sectors').select('district,owner_profile_id,captured_at').eq('server_id', serverId);
  if (error) throw error;
  return data || [];
}
