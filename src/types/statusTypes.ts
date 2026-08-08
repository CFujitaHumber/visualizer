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

type CourseTrailPoint = {
    x: number;
    y: number;
    /** ASV heading in degrees at this trail point. */
    heading: number;
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
        courseTrail: CourseTrailPoint[];
    };
    planning: {
        status: TaskStatus;
        course: Path;
        plan: Path;
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
        status: TaskValues.standby,
        course: [],
        plan: []
    },
    task: {
        log: [],
        location: { latitude: 0, longitude: 0 },
        data: { id: 0, name: "", status: "standby", latitude: 0, longitude: 0 }
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

export type { Status, CourseTrailPoint, Zed, ZedPosition, ZedOrientation, Frame };
export { InitialStatus };
