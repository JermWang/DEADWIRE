# Deadwire

Low-poly browser PvPvE extraction game. Raid dead reactor zones, fight rogue
machines, steal the unstable core, and extract with your haul.

This repo holds the **Core Run** MVP prototype and the **coded asset pipeline**
that produces every in-game asset. See `MASTER_BLUEPRINT.md` for full direction.

## Run it

```bash
npm run dev
```

- **Game**  → http://127.0.0.1:5180/game/
- **Studio** → http://127.0.0.1:5180/game-asset-pipeline/studio/

No build step. Three.js loads from a CDN via import maps; the dev server is
Node built-ins only and serves the whole project so the game can import the
shared asset library.

### Play online (2–6 runners)

In a second terminal, start the match server, then deploy online from two
browser tabs:

```bash
npm run server        # ws://127.0.0.1:5181  (dependency-free WebSocket server)
```

On the deploy screen pick **DEPLOY ONLINE**. The server is authoritative for the
match clock, core-spawn timing, who holds the unstable core, and crate ownership;
players relay position/health/shots and PvP hits. PvE machines are still simulated
per-client for this slice. If the server is down, the game falls back to solo.

## Controls

`WASD` move · `Shift` sprint · `Space` jump · `Q` roll · `Mouse` look ·
`Right mouse` ADS · `Left mouse` fire · `E` interact / loot / take core ·
stand in a green extraction zone to extract.

## What's in the box

```
game/                     Core Run prototype (Three.js, orthographic)
  src/core/               Game loop, input, camera rig
  src/world/              Breaker Yard map (data-driven) + collision
  src/entities/           Player, Enemy, Projectile, LootCrate, Core, Extraction
  src/systems/            Stash (localStorage persistence)
  src/ui/                 HUD, results screen, styles
  src/net/                NetClient seam for future WebSocket multiplayer
game-asset-pipeline/
  asset-lib/              Shared coded asset builders + registry (source of truth)
  studio/                 Asset creator: preview, pose, sockets, live budget QA
  (manifest/, scripts/)   Original GLB/AI pipeline lane (kept)
tools/                    Dev server + asset QA
```

## The loop (verified working)

Deploy → loot crates → fight Crawlers → core comes online → grab it (slows you,
pings your position) → run to the south extraction road → extract → results
(loot, machines destroyed, core status, XP) → stash updates → run it back.

## Scripts

| command | does |
| --- | --- |
| `npm run dev` | serve game + studio |
| `npm run qa:assets` | validate the coded asset registry |
| `npm run qa:glb` | validate the legacy GLB manifest lane |

## Asset workflow

How to generate, edit, and track assets is documented in
[`ASSET_SYSTEM.md`](ASSET_SYSTEM.md). Short version: edit a builder under
`game-asset-pipeline/asset-lib/`, see it live in the studio, and the same module
ships in the game.

## Not built yet (by design)

Wallets, smart contracts, marketplace, multiple maps. Multiplayer is a first
2–6 player slice (see "Play online"): players, PvP, the core, and crates sync;
server-authoritative PvE enemy sync, anti-cheat, and reconnection are follow-ups.
Keep the loop tense before making it big.
