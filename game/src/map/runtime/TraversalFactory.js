export function createTraversalLink(params) {
    return { ...params };
}
export const rooftopBridge = (params) => createTraversalLink({ ...params, type: 'rooftop_bridge' });
export const alleyShortcut = (params) => createTraversalLink({ ...params, type: 'alley_shortcut' });
export const undergroundTunnel = (params) => createTraversalLink({ ...params, type: 'underground_tunnel' });
export const rampLink = (params) => createTraversalLink({ ...params, type: 'ramp' });
export const ladderLink = (params) => createTraversalLink({ ...params, type: 'ladder' });
//# sourceMappingURL=TraversalFactory.js.map