/**
 * @file geo.ts
 * @description Small geodesy helpers shared by telemetry HUD components.
 *
 * @author Carson Fujita
 * @license MIT
 */

/**
 * Converts the difference between two lat/lon points into local, flat-earth
 * meters (x = east, y = north), using an equirectangular approximation
 * anchored at `lat1`/`lon1`. Accurate enough for the short ranges (tens of
 * meters) the ASV operates over; not suitable for long-distance navigation.
 */
const measureLocalMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6378137; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const x = dLon * Math.cos((lat1 * Math.PI) / 180) * R;
    const y = dLat * R;
    return { x, y };
};

/**
 * Rotates a boat-relative position (x = right, y = forward, as reported by
 * the ZED's object detection) by the vessel's current heading and translates
 * it by the vessel's current world-frame position, producing a world-frame
 * position in the same frame the vessel's own position (`zed.odom.position`)
 * is expressed in. `z` passes through unchanged.
 */
const projectBoatRelative = <T extends { x: number; y: number; z: number }>(
    position: T,
    headingDeg: number,
    anchor: { x: number; y: number },
): T => {
    const headingRad = (headingDeg * Math.PI) / 180;
    const cos = Math.cos(headingRad);
    const sin = Math.sin(headingRad);
    return {
        ...position,
        x: anchor.x + (position.x * cos + position.y * sin),
        y: anchor.y + (-position.x * sin + position.y * cos),
    };
};

export { measureLocalMeters, projectBoatRelative };
