/**
 * @file status.ts
 * @description Defines the Status type and its initial value for the ASV telemetry system.
 * This file is used to maintain a consistent structure for the status data across the application.
 * It includes information about the map, planning, task, power, rudder, ASV state, signal strength, and video stream.
 * 
 * @author Carson Fujita
 * @license MIT
 */
import type { Path, Grid } from "react-isometric-engine";
import type { TaskData, TaskLocation, TaskStatus } from "./taskTypes";
import { TaskValues } from "./taskTypes";
import type { DetectedObject } from "./detectedObjectsTypes";

/**
 * A point on the tactical map's course trail, in **metres** in the GPS-derived local
 * tangent-plane frame (see {@link Frame}).
 *
 * @remarks
 * The unit matters and used to be ambiguous. `map.courseTrail` had two writers in two
 * different units — `TacticalMapPanel` in metres and the isometric scene in grid cells —
 * and three readers that each assumed one or the other, so whichever component moved last
 * decided what the shared array meant. The isometric scene now keeps its own cell-space
 * trail in `sceneTrailSlice`; this one is metres, and belongs to the tactical maps.
 */
type CourseTrailPoint = {
    x: number;
    y: number;
    /** ASV heading in degrees at this trail point. */
    heading: number;
};

/**
 * The vessel's pose on the SLAM map, as resolved by the bridge from the
 * `map -> base_link` TF.
 *
 * @remarks
 * This is the only honest source of where the boat is on `occupancyGrid`. GPS is in a
 * different frame entirely (loone's config keeps `gps_map` deliberately distinct from
 * SLAM's `map`), and `zed.odom` is the camera's own drifting visual-odometry frame with
 * no loop closure — neither can be placed on the map's cells. Before this existed the
 * isometric scene dead-reckoned the vessel from speed and heading starting at the board's
 * centre, which drew fiction on top of real obstacle data.
 *
 * `null` is meaningful and distinct from absent: it is the bridge reporting that TF has
 * gone stale, and consumers must stop drawing the vessel rather than freeze it in place.
 */
type VesselPose = {
    /** Map-frame metres east, in the same frame as {@link MapInfo.origin}. */
    x: number;
    /** Map-frame metres north, in the same frame as {@link MapInfo.origin}. */
    y: number;
    /**
     * Compass heading in degrees (0 = north, 90 = east). Converted by the bridge from
     * the transform's ENU yaw, so the client never has to know which convention the
     * map frame uses.
     */
    heading: number;
};

/**
 * Describes the real-world meaning of `map.occupancyGrid`, derived from
 * `nav_msgs/OccupancyGrid.info` by the bridge.
 *
 * @remarks
 * Without this the client has no idea what one grid cell is worth, which is why the
 * isometric scene used to treat the vessel's metres-per-second as cells-per-second. The
 * grid the client receives is a downsample of the SLAM map, so `resolution` is the
 * *coarsened* value (metres per rendered cell), not the source map's.
 */
type MapInfo = {
    /** Rendered grid width in cells — matches `occupancyGrid[0].length`. */
    cols: number;
    /** Rendered grid height in cells — matches `occupancyGrid.length`. */
    rows: number;
    /** Metres per rendered cell, after downsampling. */
    resolution: number;
    /**
     * Map-frame position, in metres, of the board's (0,0) corner — its **north-west**
     * corner.
     *
     * @remarks
     * The board is emitted north-up: `+col` is map `+x` (east) and `+row` is map `-y`
     * (south). That is *not* `nav_msgs/OccupancyGrid`'s own layout, which is row-major
     * from its south-west origin; the bridge flips the rows because the isometric engine
     * draws increasing row toward screen `+y` and treats `-y` as north (its physics
     * integrates heading 0 as `dy = -v`). Passing the rows through unflipped rendered the
     * live map upside-down, which went unnoticed only for as long as nothing real was
     * positioned on it.
     *
     * So a map-frame point converts to board cells as:
     * `col = (x - origin.x) / resolution`, `row = (origin.y - y) / resolution`.
     */
    origin: { x: number; y: number };
    /**
     * Flat row-major mask of cells SLAM has actually observed, `row * cols + col`.
     *
     * Downsampling collapses OccupancyGrid's -1 (unknown) and 0 (known-clear) into the
     * same empty cell, so the grid alone cannot distinguish unsurveyed water from open
     * water. Fog-of-war needs that distinction or it either hides known-clear cells or
     * reveals the whole map at once. Omitted by producers with no notion of unknown
     * (the factory's synthetic map is wholly surveyed), in which case treat all cells
     * present in the grid as known.
     */
    known?: boolean[];
};

type ZedPosition = { x: number; y: number; z: number };
type ZedOrientation = { roll: number; pitch: number; yaw: number };

/**
 * Client-only local tangent-plane origin. Never sent by the basestation — it is
 * captured on the first valid GPS fix and then held fixed, so `asv.latitude`/
 * `asv.longitude` can be converted into a stable local-meters frame (see
 * `selectVesselLocalMeters`).
 *
 * @remarks
 * This exists because `zed.odom.position` is NOT a usable common frame across
 * modes: the real bridge fills it from the ZED's `nav_msgs/Odometry` (true
 * meters), while the basestation's factory mode deliberately mirrors
 * `asv.longitude`/`asv.latitude` into it (degrees). Map consumers work in
 * meters, so factory mode moved ~1e-5 units/tick and every distance threshold
 * (course-trail sampling, teleport snap) silently never fired. Deriving the
 * frame from GPS instead works identically in both modes.
 */
type Frame = {
    originLatitude: number;
    originLongitude: number;
    /** False until the first non-null fix is seen; consumers should treat the frame as unusable. */
    hasOrigin: boolean;
};

type Zed = {
    odom: {
        position: ZedPosition;
        orientation: ZedOrientation;
    };
    objects: DetectedObject[];
    camera: {
        active: boolean;
        width: number;
        height: number;
        encoding: string;
    };
};

type Status = {
    map: {
        // No basestation publisher exists yet for either grid (confirmed: no OccupancyGrid/
        // costmap subscriber anywhere in Base-Station-Flask) — these stay at their empty
        // InitialStatus default until the bridge subscribes to SLAM Toolbox's /map (the
        // ASV side has moved off nav2/ros2_control onto SLAM Toolbox for mapping).
        // Consumers should render conditionally on non-empty data, as Map.tsx already does.
        occupancyGrid: Grid;
        navigationGrid: Grid;
        // The basestation doesn't send this either — built client-side instead, in
        // TacticalMapPanel, from the GPS-derived local-meters frame + asv.heading.
        // METRES, and tactical-map-owned: the isometric scene keeps its own cell-space
        // trail in sceneTrailSlice. See {@link CourseTrailPoint}.
        courseTrail: CourseTrailPoint[];
        /**
         * Metadata describing what `occupancyGrid` actually represents. Absent until the
         * bridge has received a `/map`, which is why every consumer must tolerate it being
         * undefined rather than assuming a scale.
         */
        info?: MapInfo;
        /**
         * Where the vessel actually is on `occupancyGrid`. Absent before the bridge has
         * looked TF up at all; explicitly `null` once TF has gone stale. See
         * {@link VesselPose} — consumers must distinguish "no pose" from a last-known
         * one and stop drawing the vessel rather than leave it frozen over live data.
         */
        vesselPose?: VesselPose | null;
    };
    planning: {
        status: TaskStatus;
        course: Path;
        plan: Path;
    };
    /**
     * The vessel's physical status light, as the bridge received it on `led`
     * (std_msgs/ColorRGBA). Channels are 0..1 floats, NOT 0..255.
     *
     * @remarks
     * This is the authoritative statement of what mode the boat is in, because it
     * is the same signal the safety judges read off the mast: green = autonomous,
     * amber (red+green) = manual/remote, red = e-stop. `planning.status` is derived
     * from the `task` topic and can disagree with the light if the autonomy
     * pipeline and the e-stop line disagree — when they do, the light wins.
     *
     * `alpha` doubles as a has-data flag: it is 0 in {@link InitialStatus} and stays
     * 0 until a real ColorRGBA arrives, so `alpha === 0` means "no light reported",
     * not "a transparent light". Consumers must fall back to `planning.status`
     * rather than render black. See {@link ledStatusColor}.
     */
    led: {
        red: number;
        green: number;
        blue: number;
        alpha: number;
    };
    task: {
        log: string[];
        location: TaskLocation;
        data: TaskData;
    };
    rudder: {
        angle: number;
    };
    battery: {
        motors: number;
        primary: number;
        /**
         * False when the basestation has no reading from the battery sensor, which means
         * the percentages above aren't real. Absent from simulated telemetry and older
         * basestations, which is treated the same as true.
         */
        sensorConnected?: boolean;
    }
    motors: {
        left: number;
        right: number;
    };
    asv: {
        speed: number;
        heading: number;
        longitude: number;
        latitude: number;
    };
    signal: {
        strength: number;
    };
    zed: Zed;
    system: {
        /** Names of the ROS2 topics/services the basestation bridge subscribes to. */
        topics: string[];
    };
    /** Client-only — absent from every basestation payload. See {@link Frame}. */
    frame: Frame;
}
    
const InitialStatus: Status = {
    map: {
        occupancyGrid: [],
        navigationGrid: [],
        courseTrail: [],
    },
    planning: {
        status: TaskValues.lostConnection,
        course: [],
        plan: []
    },
    task: {
        log: [],
        location: { latitude: 0, longitude: 0 },
        data: { id: 0, name: "", status: "lost connection", latitude: 0, longitude: 0 }
    },
    rudder: {
        angle: 0
    },
    motors: {
        left: 100,
        right: 100
    },
    battery: {
        motors: 0,
        primary: 0
    },
    asv: {
        speed: 0,
        heading: 0,
        longitude: 0,
        latitude: 0
    },
    led: {
        red: 1,
        green: 1,
        blue: 1,
        alpha: 1,
    },
    signal: {
        strength: 100
    },
    zed: {
        odom: {
            position: { x: 0, y: 0, z: 0 },
            orientation: { roll: 0, pitch: 0, yaw: 0 },
        },
        objects: [],
        camera: {
            active: false,
            width: 0,
            height: 0,
            encoding: "",
        },
    },
    system: {
        topics: [],
    },
    frame: {
        originLatitude: 0,
        originLongitude: 0,
        hasOrigin: false,
    },
};

// zed.objects[] positions arrive boat-relative (x = right, y = forward) from the
// basestation — the bridge has no TF2/GPS fusion, so it can't transform them itself.
// They are STORED that way, exactly as received: the reducers no longer rewrite them.
// Consumers that need world-frame obstacles select them through
// `selectZedObjectsWorld`, which rotates by asv.heading and anchors to the
// GPS-derived local-meters position. Consumers that want the raw boat-relative
// reading (the radar/minimap, whose whole display is boat-centric) read
// `zed.objects` directly.
//
// This split replaced an earlier design that projected at ingestion time. That was
// wrong twice over: `setZedObjects` and FETCH_TELEMETRY_SUCCESS projected but
// SET_STATUS did not, so the same field meant different things depending on which
// action last wrote it; and RadiusVisualizerPanel still treated the stored value as
// boat-relative, plotting world coordinates on a 40 m radar.
//
// zed.odom.{position,orientation} are the ZED's own local visual-odometry frame and
// are used as-is (not fused with GPS/compass). They are NOT the map frame — see {@link Frame}.

export type { Status, CourseTrailPoint, Zed, ZedPosition, ZedOrientation, Frame, MapInfo, VesselPose };
export { InitialStatus };
