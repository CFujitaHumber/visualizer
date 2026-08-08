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
        // TacticalMapPanel, from live zed.odom.position + asv.heading.
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
};

// zed.objects[] positions arrive boat-relative (x = right, y = forward) from the
// basestation — the bridge has no TF2/GPS fusion, so it can't transform them itself.
// The frontend projects them into the same world frame zed.odom.position is expressed
// in (using asv.heading + zed.odom.position as the rotation/anchor) at ingestion time,
// in telemetrySlice's setZedObjects and FETCH_TELEMETRY_SUCCESS reducers — see those
// for the actual transform. zed.odom.{position,orientation} themselves are the ZED's
// own local visual-odometry frame and are used as-is (not fused with GPS/compass).

export type { Status, CourseTrailPoint, Zed, ZedPosition, ZedOrientation };
export { InitialStatus };
