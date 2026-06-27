# Web3 Game Asset Pipeline

This is the first functional scaffold for a repeatable 2D-to-3D asset pipeline for browser/Solana games.

The pipeline shape is:

`style LoRA / reference pack -> generated PNG concept -> cleanup/reference views -> image-to-3D draft -> Blender cleanup -> optimized GLB -> Three.js preview -> QA report -> game manifest`


## Character Rigging Rule

All character assets that may be animated, equipped, mounted, customized, or reused across games must be generated in a clean **T-pose** by default. A relaxed A-pose is acceptable only when the rigging workflow specifically prefers it.

Character source images should use:

- Full body visible from head to feet.
- Arms extended horizontally in T-pose, palms simple and visible.
- Straight neutral legs, feet flat and separated slightly.
- Symmetrical front view or very slight front three-quarter view.
- No dramatic action pose, crossed arms, bent elbows, seated pose, crouch, props blocking joints, or cropped limbs.


## Quick Start

From this folder:

```bash
node scripts/create-sample-asset.mjs
node scripts/qa-manifest.mjs
node scripts/serve-preview.mjs
```

Then open:

```text
http://127.0.0.1:5177/preview/
```

The preview uses Three.js from a CDN. The QA script and sample asset generation use only Node.js built-ins.

## What Is Functional Now

- `manifest/assets.json` defines the asset contract we will use across games.
- `scripts/create-sample-asset.mjs` generates a real GLB smoke-test asset plus concept/icon/thumbnail SVGs.
- `scripts/qa-manifest.mjs` checks that manifest assets exist, parse as GLB, and stay inside budget.
- `preview/index.html` loads the manifest and renders the GLB in a Three.js browser preview.
- `manifest/pipeline-stack.json` records the real model/tool candidates and license cautions.

## Real Production Tools

The current recommended lanes are:

- **Image generation:** FLUX.1-schnell for fast permissive concept generation; SDXL for broad ecosystem and LoRA workflows.
- **Style consistency:** project-specific LoRA or reference pack, likely run through ComfyUI.
- **Background cleanup:** RMBG-2.0 or a comparable segmentation/matting model after license review.
- **Image-to-3D:** Hunyuan3D 2.1 for highest-fidelity candidate output after license review; Stable Fast 3D for fast prototype assets; TripoSR as permissive MIT fallback.
- **Cleanup:** Blender.
- **Optimization:** glTF-Transform plus Meshopt/Draco/KTX2 where appropriate.
- **Runtime:** Three.js, with GLB assets and DOM/CSS UI.

## Production Rule

No generated asset is considered game-ready until it has:

- A final GLB.
- A final icon rendered from the GLB.
- Manifest metadata.
- Source model, prompt, seed, and license notes.
- QA report pass.
- In-game camera screenshot pass on desktop and mobile.

