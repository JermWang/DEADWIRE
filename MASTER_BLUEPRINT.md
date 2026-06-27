# DEADWIRE MVP Master Blueprint

Updated: June 26, 2026

## One-Line Pitch

**Deadwire is a browser PvPvE extraction game where runners raid dead reactor zones, fight rogue machines and rival players, steal unstable cores, and extract with gear, parts, and cosmetics.**

## Product Direction

Deadwire should feel like a real multiplayer browser game first. The chain, wallets, custody, marketplace, and asset ownership should sit underneath the game layer and should not be part of the game fiction.

Do not frame the game around chain names, token mechanics, or DeFi language. Players should hear:

- stash
- black market
- vault
- contract
- parts
- cores
- permits
- crew bank
- extraction
- sector control

Not:

- Solana
- staking
- liquidity
- yield
- token farming
- smart contracts

## Target Game Shape

Deadwire is not a first-person shooter. The achievable MVP is an **isometric / orthographic PvPvE extraction shooter** built in Three.js.

The feel should be:

- fast to understand
- tense when carrying valuable loot
- readable in browser
- social and competitive
- cosmetic-driven
- low-poly, apocalypse, industrial, coded-asset style

## Inspiration Guardrails

Arc Raiders is useful as a reference for:

- surface raids
- hostile machines
- extraction pressure
- PvPvE tension
- grounded scavenger fantasy

Deadwire should differ through:

- grimy arcade extraction wasteland
- reactor-zone fiction
- low-poly PS1/PS2 coded asset style
- universal cosmetics and modular socket system
- browser-first controls and readability

## Core MVP Mode: Core Run

Core Run is the one mode to build first.

### Match Rules

- 6 players.
- 8 minute match.
- Solo or duo-ready, but solo can be first.
- One medium map.
- PvP enabled.
- PvE enemies guard loot and objectives.
- Extraction zones open from the start.
- One high-value unstable core spawns mid-match.
- Players can extract small loot early or risk staying.

### Core Objective

The unstable core creates the drama.

- Spawns around minute 3.
- Siren and world pulse announce it.
- Enemies converge on it.
- Picking it up slows the carrier by about 25%.
- Carrier emits a rough location pulse every 15 seconds.
- If carrier dies, the core drops.
- Extracting with it gives the best reward.
- If no one extracts it before timeout, it detonates or burns out.

### Player Story Target

The MVP works if a player can say:

> I deployed, found loot, heard the core siren, got nervous carrying it, fought another runner, barely extracted, and wanted one more run.

## MVP Map: Breaker Yard

One map only.

### Layout

- Central reactor pit.
- North warehouse.
- East rail platform.
- West scrap maze.
- South extraction road.
- Two extraction points.
- Twelve loot crates.
- Three enemy nests.
- One core spawn chamber.
- Cover lanes and chokepoints.

### Visual Theme

- dead factories
- reactor towns
- buried malls
- highway graveyards
- flooded data centers
- rail yards
- black-market settlements
- machine nests
- dust storms
- red warning lights
- cables, generators, vents, terminals

## Player Controls

Keep controls simple and browser-friendly.

- WASD movement.
- Mouse aim or target-lock shooting.
- Left click fire.
- Right click dodge/roll or aim mode.
- E interact / loot / extract.
- 1/2 weapon swap.
- Tab inventory overlay.

No precision FPS aiming. Use generous hitboxes, visible projectiles, slower movement, and cover.

## Combat MVP

### Weapons

Only three weapons at first:

- Scrap Pistol: reliable, low damage.
- Burst Rifle: mid-range, controlled burst.
- Arc Shotgun: close-range burst.

### Enemy Types

Only three enemies at first:

- Crawler: rushes player.
- Turret: stationary line-of-sight threat.
- Hauler: slow tank guarding high-value loot.

### Combat Rules

- Cover blocks shots.
- Projectiles are visible.
- Damage numbers and hit flashes.
- Clear reload or cooldown.
- PvP should be readable, not twitchy.

## Loot And Progression

### Match Loot

- Scrap.
- Parts.
- Ammo.
- Core shards.
- Cosmetic roll ticket.
- Rare found cosmetic.

### Results Screen

Show:

- extracted loot
- players damaged / defeated
- machines destroyed
- core extracted or lost
- reputation XP
- stash update

### Stash

Local database or JSON for MVP.

No wallet required in the first playable slice.

## Long-Term Asset Value

The long-term pull should come from visible status and game identity:

- rare extraction cosmetics
- seasonal skins
- crew badges
- boss drops
- event gear
- founder cosmetics
- black-market trading
- extraction flares
- death markers
- drones / pets
- mounts / vehicles

Avoid pay-to-win. Paid or rare gear should not create direct combat superiority.

## Universal Cosmetic System

This is a core pillar. Cosmetics should feel valuable and reusable across the whole game.

### Base Character Sockets

All humanoid characters should support:

- head
- face
- torso
- arms
- legs
- boots
- hands
- backpack socket
- shoulder socket
- weapon socket
- hip socket
- mount socket
- aura / fx socket
- face / helmet socket
- nameplate / title
- extraction flare
- death marker

### Cosmetic Categories

- helmet
- mask
- jacket
- pants
- boots
- gloves
- chest plate
- backpack
- weapon skin
- drone / pet
- mount / vehicle
- emote
- extraction flare
- death marker
- nameplate
- title

### Universal Rule

Every cosmetic should work on every base character silhouette unless explicitly marked as body-type locked.

### Character Asset Rule

All riggable character assets should be generated or built in T-pose by default.

Use:

- full body visible
- arms extended horizontally
- hands visible
- straight neutral legs
- feet visible and slightly separated
- symmetrical front view or slight front three-quarter view
- unobstructed joints

Avoid:

- action pose
- bent elbows
- crossed arms
- cropped limbs
- props blocking joints
- seated pose
- crouch
- dramatic perspective

## Asset Pipeline Decision

Use **coded / parametric low-poly assets** as the default production path for riggable characters, NPCs, enemies, bosses, mounts, weapons, and core gameplay objects.

AI remains useful for:

- concepts
- reference sheets
- colorways
- item icons
- texture ideas
- posters / season art
- marketplace art
- non-rigged props

Image-to-3D remains experimental. Keep outputs for comparison, but do not make them the production character path unless they beat coded assets in topology, file size, rigging readiness, and QA.

### Active Asset Pipeline Folder

The cloned pipeline in this project is:

```text
game-asset-pipeline/
```

It contains:

- manifest contract
- preview scene
- QA script
- coded sample assets
- archived AI image-to-3D experiments
- character asset rules
- pipeline decision file

## Technical MVP Plan

### Architecture

- Three.js client.
- Orthographic camera.
- Coded low-poly GLB assets.
- HTML/CSS HUD.
- Lightweight local server.
- WebSocket match server.
- Local JSON or SQLite-like persistence for MVP.
- Later: Privy login and wallet-backed inventory.

### Build Order

1. Project scaffold.
2. Three.js map scene.
3. Player movement.
4. Shooting and hit detection.
5. Enemy AI.
6. Loot crates.
7. Extraction zones.
8. Core spawn and carrier rules.
9. PvP sync.
10. Match results.
11. Stash / cosmetics preview.
12. Basic lobby.

### Multiplayer Shape

PvPvE should exist from the jump, but keep it simple.

Day-one networking target:

- 2-6 clients.
- Position sync.
- Player health.
- Shots/projectiles.
- Loot pickup ownership.
- Core carrier state.
- Extraction events.

Server authority can be lightweight for the first prototype, then hardened later.

## MVP Cuts

Do not build yet:

- smart contracts
- wallet login
- marketplace
- crafting trees
- multiple maps
- boss fights
- mounts
- advanced enemy AI
- procedural world generation
- full economy
- ranked PvP
- mobile controls

## Account And Wallet Layer Later

Best eventual UX:

- email/social/wallet login through Privy-style account abstraction
- custody wallet by default for normal players
- connect/export wallet for crypto-native users
- inventory looks like a game inventory first
- chain settlement only appears for ownership, marketplace, withdrawals, or rare item minting

## Tone Rules

The game should sound direct and punchy.

Use:

- core
- run
- sector
- relay
- stash
- black market
- crew
- extraction
- reactor
- parts
- scrap
- signal
- lockdown

Avoid:

- mystical network poetry
- blockchain jargon
- financial jargon
- chain branding inside the game
- farm/heist/cop framing

## Short Pitch

Deadwire is a low-poly browser PvPvE extraction game where crews raid dead reactor zones, fight rogue machines and rival runners, steal unstable cores, and extract with gear, parts, and cosmetics.

## Immediate Next Step

Build a playable `Breaker Yard` prototype with:

- one coded runner character
- one coded enemy
- one weapon
- one crate
- one extract zone
- one unstable core
- local match loop first
- then two-client PvP sync

Keep the loop small. Make it tense before making it big.
