# Deadwire Asset System

This is how we **generate, edit, and track every in-game asset** — characters,
enemies, weapons, props, the map kit, and cosmetics. One source of truth feeds
both the asset studio and the live game, so what you sculpt is exactly what ships.

## Principle: one builder, two consumers

```
            game-asset-pipeline/asset-lib/   (SINGLE SOURCE OF TRUTH)
            ├── palette.js      shared colors + material factory
            ├── sockets.js      universal cosmetic slot list
            ├── prim.js         box/cyl/sphere/socket helpers + inspect()
            ├── builders/       one parametric module per asset  ← you edit these
            ├── cosmetics/      cosmetic slot pieces
            ├── builders/index.js   id -> build() map  (browser)
            └── registry.js     master catalog: metadata + budgets (pure data)
                       │
          ┌────────────┴─────────────┐
          ▼                            ▼
   studio/ (the creator)        game/ (the prototype)
   preview · pose · sockets     imports the SAME builders
   live tris/materials vs budget   via game/src/assets.js
```

A coded asset is a function that returns a `THREE.Group`. Because it is code, we
control topology, file size, materials, rigging sockets, and recolors precisely —
the production path chosen in `PIPELINE_DECISION.md`. AI stays in the concept lane.

## The three verbs

### Generate — add a new asset
1. Create `asset-lib/builders/my_asset.js` exporting `build(opts)` → `THREE.Group`.
   Pull colors from `palette.js`, build with `prim.js` helpers, add named
   `socket(...)` anchors for anything that attaches.
2. Register it in `asset-lib/builders/index.js` (add to the `BUILDERS` map).
3. Add a metadata row to `asset-lib/registry.js` (id, displayName, category,
   module path, budgets, tags, slot if cosmetic).
4. It now appears in the studio automatically and is callable in-game via
   `buildAsset('my_asset')`.

### Edit — iterate on an asset
Open the **studio** (`npm run dev` → `/game-asset-pipeline/studio/`), select the
asset, edit its builder file, refresh. The live readout shows triangles and
materials against the registry budget (green = within, red = over). Toggle
**T-pose** for rig-ready authoring and **Sockets** to see attachment points.

### Track — keep the catalog honest
- `registry.js` is the catalog of everything that exists.
- `npm run qa:assets` validates the whole registry without a browser: required
  metadata present, builder modules exist on disk, cosmetic slots are valid,
  budgets sane, ids unique.
- `npm run stats` instantiates every asset headlessly and prints triangle +
  material counts vs budget (dev-only; needs `npm install three --no-save`).
- The studio enforces triangle/material budgets visually per asset.
- Legacy AI / GLB experiments still validate via `npm run qa:glb`
  (the original `manifest/assets.json` lane is untouched).

## Universal cosmetics

Every humanoid (`char_runner`) exposes the socket set in `sockets.js`
(head, face, backpack, shoulder_l/r, weapon, hip, mount, aura, nameplate,
extraction, death, …). Any cosmetic declares its `slot` and snaps onto that
socket on any character silhouette — test it live with the studio's cosmetic
dropdown, or in the game's deploy-screen loadout.

## Character authoring rule

Riggable characters are authored **T-pose** by default (see
`game-asset-pipeline/CHARACTER_ASSET_RULES.md`). Builders take `pose:'tpose'`
(rig-ready, arms horizontal) vs `pose:'game'` (gameplay stance). Sockets are
identical between poses, so cosmetics and future skeletons line up.

## Procedural rigs

Characters and enemies can expose lightweight Object3D joint rigs with
`defineRig()` from `asset-lib/rig.js`. Each joint declares a stable id, display
label, body group, pivot node, and per-axis rotation limits. The studio detects
this contract automatically and opens a rig workbench with joint selection,
live pose sliders, reset controls, and optional joint-axis markers.

The current first-pass rigs cover the Runner, Crawler, Turret, and Hauler. These
are procedural transform rigs for posing and game animation; a future skinned
mesh/import lane can map bones onto the same stable joint ids.

`asset-lib/animations.js` is the shared action library used by both the studio
preview and live gameplay. The Runner currently has idle, walk, sprint, jump,
hip-fire, ADS-fire, reload/swap, roll, interact, hit, and death actions. Enemy
sets stay intentionally compact: idle, move/scan, attack, hit, and death.

## Conventions

- **Style target**: Wii-era readability meets chunky voxel silhouettes. Favor
  bold proportions, clean color blocking, and one or two strong accent/glow cues
  per asset. Avoid tiny repeated greebles unless they are important for gameplay
  readability.
- **IDs**: `category_name` (`enemy_crawler`, `weapon_scrap_pistol`, `prop_loot_crate`).
- **Primitives** (`prim.js`): `box`, `cyl`, `cylX`, `cylZ`, `cone`, `capsule` (faceted limbs/joints),
  `plate` (a tiltable box for sloped armor — use this instead of hand-rolled prisms,
  which can cull faces under flat shading), `sphere`, `socket`, `group`. Keep radial
  segments low (4–6) for the PS1/PS2 facet look.
- **Colors**: never hard-code hex in a builder — add it to `palette.js`.
- **Materials are shared**: `mat()` caches plain (non-emissive, non-transparent)
  materials by color/roughness/metalness, so reusing a color across a build costs
  one material, not many. Emissive/transparent materials stay unique (the game
  animates them per-instance) — only those count toward a real material budget.
- **Blockers**: world props that stop movement set `userData.blocker` plus either
  `radius` or `half:[hx,hz]`; the map reads these for collision.
- **Animated bits**: expose `userData.glow` / `userData.fan` so the game can
  pulse/spin them each frame.
- **Budgets** live only in `registry.js`. Keep them tight (browser performance).
