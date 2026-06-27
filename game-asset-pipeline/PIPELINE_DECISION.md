# Pipeline Decision

Updated: June 26, 2026

## Decision

Use **coded / parametric low-poly assets** as the default production path for riggable characters, NPCs, enemies, bosses, mounts, and core gameplay objects.

AI image generation remains useful for:

- Concept exploration.
- Style reference.
- Marketplace thumbnails.
- Texture ideas.
- Non-rigged props.
- Rough blockouts.

Image-to-3D remains experimental. Keep outputs for comparison, but do not treat them as production-ready character assets unless they pass topology, rigging, cleanup, and visual QA.

## Why

The coded PS1 cop outperformed the image-to-3D output on:

- Silhouette control.
- Topology clarity.
- File size.
- Material control.
- Rigging readiness.
- Repeatability.
- Browser performance.

The TripoSR test proved the AI pipeline can produce a GLB, but the result is less controlled than the coded version. Stable Fast 3D was unavailable upstream during testing.

## Character Path

```text
AI concept/reference -> parametric character generator -> GLB -> manifest -> preview -> QA -> rig/animation pass
```

## Prop Path

```text
AI concept -> optional image-to-3D -> Blender cleanup or coded rebuild -> GLB -> manifest -> preview -> QA
```

## Rule

For final playable characters, coded/parametric wins unless an external generator produces a clean, riggable, low-poly mesh that beats the coded asset in QA.
