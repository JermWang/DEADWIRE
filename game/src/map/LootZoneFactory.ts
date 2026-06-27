import type { LootTier, LootZoneDefinition, Size3, Vec3 } from './MapSchema.js';

export function createLootZone(params: {
  id: string;
  position: Vec3;
  size: Size3;
  lootTier: LootTier;
  spawnChance: number;
  containerCount: number;
  isHidden?: boolean;
  isLocked?: boolean;
  requiredKeyId?: string;
  gameplayNotes: string;
}): LootZoneDefinition {
  return {
    isHidden: false,
    isLocked: false,
    ...params,
  };
}
