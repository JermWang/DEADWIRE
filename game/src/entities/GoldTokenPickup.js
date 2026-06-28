// GoldTokenPickup - rare physical hard-currency pickup. Uses the authored GLB
// when available and keeps a small PNG billboard as a readable fallback/accent.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mat } from '../assets.js';
import { CONFIG } from '../data/config.js';

export const GOLD_TOKEN_IMAGE_URL = '/dead%20gold%20token.png';
const GOLD_TOKEN_MODEL_URL = '/gold_token.glb';

let goldTokenModelPromise = null;

function loadGoldTokenModel() {
  if (!goldTokenModelPromise) {
    goldTokenModelPromise = new Promise((resolve, reject) => {
      new GLTFLoader().load(GOLD_TOKEN_MODEL_URL, (gltf) => resolve(gltf.scene), undefined, reject);
    });
  }
  return goldTokenModelPromise;
}

function normalizeModel(root) {
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const maxAxis = Math.max(size.x, size.y, size.z, 0.001);
  const scale = 0.78 / maxAxis;
  root.scale.setScalar(scale);
  root.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
  root.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
      if (node.material) {
        node.material = node.material.clone();
        node.material.roughness = Math.min(node.material.roughness ?? 0.5, 0.42);
        node.material.metalness = Math.max(node.material.metalness ?? 0.4, 0.72);
      }
    }
  });
}

function createFallbackToken() {
  const group = new THREE.Group();
  const coin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.26, 0.08, 24),
    mat('#f5c85b', { metal: 0.7, rough: 0.28, emissive: '#7a4300', emissiveIntensity: 0.28 }),
  );
  coin.rotation.x = Math.PI / 2;
  group.add(coin);

  const texture = new THREE.TextureLoader().load(GOLD_TOKEN_IMAGE_URL);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  }));
  sprite.position.y = 0.44;
  sprite.scale.set(0.58, 0.58, 0.58);
  group.add(sprite);
  return group;
}

export class GoldTokenPickup {
  constructor(position, { qty = 1 } = {}) {
    this.qty = qty;
    this.collected = false;
    this.interactRange = CONFIG.player.interactRange * 0.92;
    this.mesh = new THREE.Group();
    this.mesh.name = 'gold_token_pickup';
    this.mesh.position.copy(position);
    this.mesh.userData.goldTokenPickup = true;

    this.visual = createFallbackToken();
    this.visual.position.y = 0.42;
    this.mesh.add(this.visual);

    const glow = new THREE.PointLight(0xffc44d, 1.2, 3.4, 2);
    glow.position.y = 0.6;
    this.mesh.add(glow);
    this.glow = glow;

    loadGoldTokenModel()
      .then((source) => {
        if (this.collected) return;
        const model = source.clone(true);
        normalizeModel(model);
        model.position.y = 0.34;
        this.mesh.remove(this.visual);
        this.visual = model;
        this.mesh.add(this.visual);
      })
      .catch(() => {});
  }

  get position() { return this.mesh.position; }

  collect() {
    if (this.collected) return [];
    this.collected = true;
    this.mesh.visible = false;
    return [{ item: 'Gold', qty: this.qty }];
  }

  update(dt, time) {
    if (this.collected || !this.visual) return;
    this.visual.rotation.y += dt * 1.4;
    this.visual.position.y = 0.4 + Math.sin(time * 3.2) * 0.055;
    if (this.glow) this.glow.intensity = 0.85 + Math.sin(time * 4.4) * 0.28;
  }
}
