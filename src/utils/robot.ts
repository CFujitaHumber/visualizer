/**
 * @file robot.ts
 * @description Physical constants for the ASV — hull dimensions and camera
 * field-of-view geometry — plus the detected-object label -> theme color
 * mapping, shared by BigMap/TacticalMap so neither hardcodes its own copy.
 *
 * @author Carson Fujita
 * @license MIT
 */

/** Hull length (bow-to-stern), meters. */
export const ROBOT_LENGTH_M = 0.97;
/** Hull width (beam), meters. */
export const ROBOT_WIDTH_M = 0.6;
/** Hull height, meters. Not currently used by the 2D top-down maps. */
export const ROBOT_HEIGHT_M = 0.68;

/** ZED field-of-view cone radius drawn on the maps, meters. */
export const FOV_RADIUS_M = 40;
/** ZED field-of-view cone half-angle, radians (the cone spans +/- this from center). */
export const FOV_HALF_ANGLE_RAD = Math.PI / 6;

/**
 * Minimum on-screen size (px) for the boat icon in BigMap, which draws the
 * icon at real-world scale (see ROBOT_LENGTH_M/WIDTH_M above) — at typical
 * zoomed-out map scales a ~1m hull would otherwise shrink to an invisible
 * dot. TacticalMap draws its icon at a fixed screen size already and doesn't
 * need this.
 */
export const MIN_BOAT_ICON_PX = 24;

/**
 * Maps a detected-object label (see njordTasksSim.ts's task obstacles, and
 * DetectedObject.label from live ZED detections) to a key in the
 * `telemetry.objects` theme palette (telemetryTheme.ts). Labels not listed
 * here fall back to DEFAULT_OBJECT_COLOR_KEY.
 *
 * "Home Dock" intentionally shares Nav Green's color — it's drawn as a
 * square instead of a circle to distinguish it, not a different color.
 */
export const OBJECT_COLOR_KEYS: Record<string, string> = {
    // Simulation labels (njordTasksSim.ts).
    'Boundary Buoy': 'boundary',
    'Nav Green': 'navGreen',
    'Home Dock': 'navGreen',
    'Nav Red': 'navRed',
    'Obstacle': 'hazard',
    'Speed Gate': 'hazard',
    'Turnaround Buoy': 'hazard',
    'Dock Buoy': 'dock',
    'Acoustic Beacon': 'beacon',
    'Island': 'island',

    // Labels the deployed ONNX detector actually emits. Without these every real
    // detection fell through to DEFAULT_OBJECT_COLOR_KEY and the whole buoy field
    // rendered a single color, making the lateral marks impossible to tell apart.
    // Matched to IALA meaning rather than to the sim names: the four cardinal marks
    // share the hazard color because that is what they mark, and "otter" is a boat
    // (the only non-buoy class the model knows), so it takes the beacon color to
    // read as a vessel rather than as a mark.
    green: 'navGreen',
    red: 'navRed',
    north: 'hazard',
    east: 'hazard',
    south: 'hazard',
    west: 'hazard',
    otter: 'beacon',
};

export const DEFAULT_OBJECT_COLOR_KEY = 'navRed';
