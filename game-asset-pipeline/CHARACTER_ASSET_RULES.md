# Character Asset Rules

## Rigging Pose

All character assets that may be animated, equipped, mounted, customized, or reused must be generated in **T-pose** by default.

Use T-pose for:

- Player avatars.
- NPCs.
- Enemies.
- Bosses.
- Wearable character variants.
- Humanoid pets.
- Creatures that will receive a skeleton.
- Mounts with animated legs, wings, tails, or necks.

A relaxed A-pose is allowed only when the rigging workflow specifically prefers it.

## Source Image Requirements

- Full body visible from head to feet.
- Arms extended horizontally for humanoids.
- Hands visible and simple.
- Straight neutral legs.
- Feet visible, flat, and slightly separated.
- Symmetrical front view or very slight front three-quarter view.
- Joints unobstructed.
- No props covering shoulders, elbows, wrists, hips, knees, or ankles.
- No cropped limbs.
- No action pose, crossed arms, crouch, seated pose, or dramatic perspective.

## Prompt Snippet

```text
full body T-pose, arms extended horizontally, straight neutral legs, feet visible, hands visible, symmetrical front view, rigging-friendly character sheet pose, joints unobstructed, clean silhouette, no action pose
```

## Negative Prompt Snippet

```text
action pose, bent elbows, crossed arms, cropped feet, cropped hands, weapon covering body joints, seated pose, crouch, extreme perspective, dramatic foreshortening, hidden joints
```
