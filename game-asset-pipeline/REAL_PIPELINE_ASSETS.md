# Real Pipeline Assets

Updated: June 26, 2026

## Recommended Lane

Use this order for the first real asset test:


## Character Asset System Note

All generated character assets should be prompted in **T-pose** by default so they can be rigged, animated, retargeted, equipped, and reused cleanly. This applies to NPCs, player avatars, humanoid enemies, bosses, wearable character variants, and any pet or creature that may need a skeleton.

Use A-pose only when the downstream rigging tool specifically prefers it. Never approve a character source image with cropped limbs, crossed arms, action poses, seated poses, bent elbows, or props blocking joints unless the asset is explicitly non-animated decorative art.

1. **Concept generation:** FLUX.1-schnell.
2. **Style consistency:** ComfyUI workflow with saved prompt, seed, reference images, and eventually a project LoRA.
3. **Background cleanup:** RMBG-2.0 or manual cleanup while license is reviewed.
4. **Image-to-3D:** Test Hunyuan3D 2.1 first for quality, then Stable Fast 3D for speed, then TripoSR as the permissive fallback.
5. **Cleanup:** Blender.
6. **Optimization:** glTF-Transform, then Meshopt/Draco/KTX2 if needed.
7. **Runtime:** Three.js GLB preview and in-game asset loader.

## Model / Tool Shortlist

| Stage | Tool | Why It Belongs | License Signal | Source |
| --- | --- | --- | --- | --- |
| Image generation | FLUX.1-schnell | Fast, strong prompt following, permissive metadata signal | `apache-2.0` | https://huggingface.co/black-forest-labs/FLUX.1-schnell |
| Image generation / LoRA ecosystem | SDXL Base 1.0 | Mature tooling and LoRA ecosystem | `openrail++` | https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0 |
| Workflow runner | ComfyUI | Repeatable local generation graphs and LoRA/reference workflows | Project license review needed | https://github.com/comfyanonymous/ComfyUI |
| Background removal | RMBG-2.0 | Cutouts for image-to-3D prep | `other`; review required | https://huggingface.co/briaai/RMBG-2.0 |
| Image-to-3D | Hunyuan3D 2.1 | Best high-fidelity candidate; PBR-oriented output | `other`; Tencent community license, territory limits | https://huggingface.co/tencent/Hunyuan3D-2.1 |
| Image-to-3D | Stable Fast 3D | Fast draft mesh generation | `other`; review required | https://huggingface.co/stabilityai/stable-fast-3d |
| Image-to-3D | TripoSR | Permissive fallback and smoke-test model | `mit` | https://huggingface.co/stabilityai/TripoSR |
| 3D cleanup | Blender | Manual cleanup, scale, origin, retopo, UVs, export | GPL app, normal asset workflow | https://www.blender.org/ |
| GLB optimization | glTF-Transform | Repeatable GLB optimization and inspection | MIT project | https://gltf-transform.dev/ |
| Runtime | Three.js | Browser-native 3D runtime; Kintara-like architecture | MIT project | https://threejs.org/ |

## First Real Asset Test

Asset: `pet_arcane_manta`

Prompt:

```text
Clean low-poly browser game asset, orthographic isometric camera, strong readable silhouette, saturated fantasy accents, rough non-photoreal materials, simple geometry that can become a GLB, no background, centered object, marketplace-ready, tiny floating manta ray companion pet, translucent blue-violet crystal fins, small gold core, friendly face, compact body, clear head/body silhouette, game mascot, front three-quarter view
```

Negative prompt:

```text
Photorealistic, text, watermark, logo, cluttered background, extra limbs, melted shape, noisy texture, extreme thin wires, transparent glass overload, tiny unreadable details, gore, horror
```

Acceptance criteria:

- PNG concept has a readable silhouette at 64px.
- Character is in T-pose or approved A-pose with visible hands, feet, and unobstructed joints.
- Background is clean or removable.
- Image-to-3D output creates one coherent mesh, not fragments.
- Blender cleanup can bring it under 8,000 triangles.
- Final GLB loads in the preview.
- Manifest QA passes.

## License Rule

Any model marked `other` is usable for exploration, but not approved for a commercial release until we review its exact current terms. For production, the manifest must include model name, model revision if available, prompt, seed, and license notes.

