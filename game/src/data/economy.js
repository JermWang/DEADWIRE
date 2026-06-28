// Economy math for beta balance. Player-facing UI should translate this into
// black-market/core-value language, while these formulas keep token quantities
// in the realistic 10k-10M trade bands for a 1B supply project.
export const TOKEN_SUPPLY = 1_000_000_000;
export const COMMON_TRADE_MIN = 10_000;
export const COMMON_TRADE_MAX = 10_000_000;

export const CORE_TIERS = {
  blue: {
    id: 'blue',
    label: 'Blue Core',
    grade: 'LOW',
    rarity: 'basic',
    color: '#4dbdff',
    hot: '#d8f5ff',
    item: 'Blue Reactor Core',
    weight: 0.36,
    baseTokens: 35_000,
    volatility: 0.42,
    shardYield: 2,
    xpBonus: 300,
  },
  yellow: {
    id: 'yellow',
    label: 'Yellow Core',
    grade: 'REGULAR',
    rarity: 'regular',
    color: '#ffc947',
    hot: '#fff7c0',
    item: 'Reactor Core',
    weight: 0.48,
    baseTokens: 180_000,
    volatility: 0.55,
    shardYield: 5,
    xpBonus: 600,
  },
  purple: {
    id: 'purple',
    label: 'Purple Core',
    grade: 'APEX',
    rarity: 'apex',
    color: '#9c76ff',
    hot: '#fff5ff',
    item: 'Apex Reactor Core',
    weight: 0.16,
    baseTokens: 1_250_000,
    volatility: 0.72,
    shardYield: 12,
    xpBonus: 1100,
  },
};

export const CORE_TIER_LIST = [CORE_TIERS.blue, CORE_TIERS.yellow, CORE_TIERS.purple];

export function getCoreTier(id = 'yellow') {
  return CORE_TIERS[id] || CORE_TIERS.yellow;
}

export function progressionScore(stash = {}) {
  const profile = stash.progression || {};
  const baseLevel = Math.max(1, Number(profile.baseLevel || 1));
  const weaponLevel = Math.max(1, Number(profile.weaponLevel || 1));
  const craftingLevel = Math.max(1, Number(profile.craftingLevel || 1));
  return Math.max(0, baseLevel - 1) * 1.05 +
    Math.max(0, weaponLevel - 1) * 0.9 +
    Math.max(0, craftingLevel - 1) * 1.15;
}

export function progressionLevels(stash = {}) {
  const profile = stash.progression || {};
  return {
    baseLevel: Math.max(1, Number(profile.baseLevel || 1)),
    weaponLevel: Math.max(1, Number(profile.weaponLevel || 1)),
    craftingLevel: Math.max(1, Number(profile.craftingLevel || 1)),
  };
}

export function runUpgradeModifiers(stash = {}) {
  const { baseLevel, weaponLevel, craftingLevel } = progressionLevels(stash);
  const baseSteps = Math.max(0, baseLevel - 1);
  const weaponSteps = Math.max(0, weaponLevel - 1);
  const craftingSteps = Math.max(0, craftingLevel - 1);
  return {
    deployAmmoBonus: Math.min(72, baseSteps * 8),
    ammoMaxBonus: Math.min(108, baseSteps * 12),
    extractHoldMultiplier: Math.max(0.72, 1 - baseSteps * 0.03),
    weaponDamageMultiplier: 1 + Math.min(0.45, weaponSteps * 0.05),
    weaponFireRateMultiplier: 1 + Math.min(0.18, weaponSteps * 0.02),
    projectileSpeedMultiplier: 1 + Math.min(0.18, weaponSteps * 0.02),
    shardBonus: Math.min(3, Math.floor(craftingSteps / 3)),
    coreCarrySpeedFactor: Math.min(0.9, 0.75 + craftingSteps * 0.018),
  };
}

export function coreTierWeights(stash = {}) {
  const score = progressionScore(stash);
  const blueReduction = Math.min(0.2, score * 0.018);
  const yellowLift = Math.min(0.08, score * 0.006);
  const purpleLift = Math.min(0.18, score * 0.014);
  return {
    blue: Math.max(0.16, CORE_TIERS.blue.weight - blueReduction),
    yellow: CORE_TIERS.yellow.weight + yellowLift,
    purple: Math.min(0.34, CORE_TIERS.purple.weight + purpleLift),
  };
}

export function chooseCoreTier(random = Math.random, stash = {}) {
  const weights = coreTierWeights(stash);
  const weighted = CORE_TIER_LIST.map((tier) => ({ tier, weight: weights[tier.id] ?? tier.weight }));
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = random() * total;
  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll <= 0) return entry.tier;
  }
  return CORE_TIERS.yellow;
}

export function coreTierOdds(stash = {}) {
  const weights = coreTierWeights(stash);
  const total = CORE_TIER_LIST.reduce((sum, tier) => sum + (weights[tier.id] ?? tier.weight), 0);
  return Object.fromEntries(
    CORE_TIER_LIST.map((tier) => [tier.id, (weights[tier.id] ?? tier.weight) / total]),
  );
}

export function estimateCoreTokenValue(tierId, run = {}, stash = {}) {
  const tier = getCoreTier(tierId);
  const profile = stash.progression || {};
  const baseLevel = Math.max(1, Number(profile.baseLevel || 1));
  const weaponLevel = Math.max(1, Number(profile.weaponLevel || 1));
  const craftingLevel = Math.max(1, Number(profile.craftingLevel || 1));
  const machines = Math.max(0, Number(run.machines || 0));
  const players = Math.max(0, Number(run.players || 0));
  const extracts = Math.max(0, Number(stash.extractions || 0));

  const progressionMultiplier =
    1 +
    Math.min(0.28, (baseLevel - 1) * 0.035) +
    Math.min(0.22, (weaponLevel - 1) * 0.028) +
    Math.min(0.22, (craftingLevel - 1) * 0.028);
  const runMultiplier =
    1 +
    Math.min(0.22, machines * 0.018) +
    Math.min(0.30, players * 0.08) +
    Math.min(0.12, extracts * 0.01);
  const liquidityDampener = 1 - Math.min(0.18, tier.baseTokens / TOKEN_SUPPLY);
  const raw = tier.baseTokens * progressionMultiplier * runMultiplier * liquidityDampener;

  return Math.round(Math.min(COMMON_TRADE_MAX, Math.max(COMMON_TRADE_MIN, raw)));
}

export function coreTokenRange(tierId) {
  const tier = getCoreTier(tierId);
  const low = Math.round(tier.baseTokens * (1 - tier.volatility));
  const high = Math.round(tier.baseTokens * (1 + tier.volatility));
  return [Math.max(COMMON_TRADE_MIN, low), Math.min(COMMON_TRADE_MAX, high)];
}

export function formatDeadTokens(value) {
  const n = Math.round(Number(value || 0));
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}
