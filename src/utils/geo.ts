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

export { measureLocalMeters };
