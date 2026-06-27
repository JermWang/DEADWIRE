import * as THREE from 'three';
const labelCache = new Map();
function makeLine(start, end, color) {
    const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(start.x, start.y, start.z),
        new THREE.Vector3(end.x, end.y, end.z),
    ]);
    return new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }));
}
function makeWireBox(size, position, color) {
    const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(size.x, size.y, size.z));
    const line = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 }));
    line.position.set(position.x, position.y, position.z);
    return line;
}
function makeLabel(text, position, color = '#ffffff') {
    if (typeof document === 'undefined')
        return null;
    const key = `${text}|${color}`;
    let texture = labelCache.get(key);
    if (!texture) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return null;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(8, 12, 18, 0.75)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = color;
        ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
        ctx.fillStyle = color;
        ctx.font = '700 34px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width - 36);
        texture = new THREE.CanvasTexture(canvas);
        labelCache.set(key, texture);
    }
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
    sprite.position.set(position.x, position.y, position.z);
    sprite.scale.set(5.2, 1.3, 1);
    sprite.renderOrder = 1000;
    return sprite;
}
export class DebugMapOverlay {
    options;
    constructor(options = {}) {
        this.options = {
            showLabels: true,
            showVolumes: true,
            showLinks: true,
            ...options,
        };
    }
    render(map) {
        const root = new THREE.Group();
        root.name = `${map.id}_debug_overlay`;
        for (const poi of map.pois) {
            this.addPOIDebug(root, poi);
        }
        if (this.options.showLinks) {
            for (const link of map.traversalLinks) {
                this.addTraversalDebug(root, link);
            }
        }
        return root;
    }
    addPOIDebug(root, poi) {
        const dangerColor = [0x6ee7ff, 0x94f06a, 0xffd166, 0xff8a3d, 0xff3b3b][poi.dangerLevel - 1];
        const topY = Math.max(...poi.floors.map((floor) => floor.y)) + 2.2;
        if (this.options.showLabels) {
            const label = makeLabel(`${poi.name} · D${poi.dangerLevel}`, { x: poi.position.x, y: topY, z: poi.position.z }, `#${dangerColor.toString(16).padStart(6, '0')}`);
            if (label)
                root.add(label);
        }
        if (!this.options.showVolumes)
            return;
        root.add(makeWireBox(poi.size, { x: poi.position.x, y: poi.position.y + poi.size.y / 2, z: poi.position.z }, dangerColor));
        for (const floor of poi.floors) {
            root.add(makeWireBox({ x: floor.size.x, y: 0.12, z: floor.size.z }, { x: poi.position.x, y: floor.y + 0.08, z: poi.position.z }, floor.y < 0 ? 0x4b62ff : 0xffffff));
            const label = makeLabel(`${floor.label} y=${floor.y}`, {
                x: poi.position.x - floor.size.x / 2,
                y: floor.y + 0.8,
                z: poi.position.z - floor.size.z / 2,
            }, '#d6e4ff');
            if (label) {
                label.scale.set(3.2, 0.8, 1);
                root.add(label);
            }
        }
        for (const loot of poi.lootZones)
            this.addLootDebug(root, loot);
        for (const cover of poi.coverZones)
            this.addCoverDebug(root, cover);
        for (const connector of [...poi.stairs, ...poi.ramps, ...poi.ladders, ...poi.elevators]) {
            root.add(makeLine(connector.start, connector.end, connector.riskLevel >= 4 ? 0xff3b3b : 0xfff06a));
        }
    }
    addLootDebug(root, loot) {
        const color = loot.isLocked ? 0xff2bd6 : loot.lootTier === 'legendary' ? 0xffd700 : 0x4dff9a;
        root.add(makeWireBox(loot.size, loot.position, color));
        const label = makeLabel(`${loot.lootTier}${loot.isLocked ? ' LOCKED' : ''}`, { x: loot.position.x, y: loot.position.y + loot.size.y / 2 + 0.8, z: loot.position.z }, loot.isLocked ? '#ff7ae6' : '#8dffbc');
        if (label) {
            label.scale.set(3.4, 0.8, 1);
            root.add(label);
        }
    }
    addCoverDebug(root, cover) {
        root.add(makeWireBox({ x: cover.size.x, y: cover.height, z: cover.size.z }, { x: cover.position.x, y: cover.position.y + cover.height / 2, z: cover.position.z }, 0x75a7ff));
    }
    addTraversalDebug(root, link) {
        const color = link.type === 'underground_tunnel'
            ? 0x7557ff
            : link.type === 'rooftop_bridge'
                ? 0xfff06a
                : link.type === 'alley_shortcut'
                    ? 0x67ffbc
                    : 0xff8a3d;
        root.add(makeLine(link.start, link.end, color));
        const mid = {
            x: (link.start.x + link.end.x) / 2,
            y: (link.start.y + link.end.y) / 2 + 0.8,
            z: (link.start.z + link.end.z) / 2,
        };
        const label = makeLabel(`${link.type} · R${link.riskLevel}`, mid, '#ffffff');
        if (label) {
            label.scale.set(3.6, 0.8, 1);
            root.add(label);
        }
    }
}
//# sourceMappingURL=DebugMapOverlay.js.map