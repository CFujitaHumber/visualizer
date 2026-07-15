/**
 * @file types/ros.ts
 * @description
 * Minimal TypeScript mirrors of the ROS 2 message shapes the ASV publishes
 * (`geometry_msgs`, `sensor_msgs`). The basestation bridges ROS messages into
 * the visualizer's {@link Status} wire format, so nothing in this library
 * consumes these directly — they exist as a typed target surface for the
 * basestation bridge and for future integration work.
 *
 * Field names intentionally match the ROS message definitions (snake_case)
 * rather than this library's conventions.
 *
 * @author Carson Fujita
 * @license MIT
 */

/** geometry_msgs/msg/Vector3 */
export interface RosVector3 {
    x: number;
    y: number;
    z: number;
}

/** geometry_msgs/msg/Point */
export type RosPoint = RosVector3;

/** geometry_msgs/msg/Quaternion */
export interface RosQuaternion {
    x: number;
    y: number;
    z: number;
    w: number;
}

/** geometry_msgs/msg/Pose */
export interface RosPose {
    position: RosPoint;
    orientation: RosQuaternion;
}

/** geometry_msgs/msg/Twist */
export interface RosTwist {
    linear: RosVector3;
    angular: RosVector3;
}

/** std_msgs/msg/Header (builtin_interfaces/msg/Time flattened) */
export interface RosHeader {
    stamp: { sec: number; nanosec: number };
    frame_id: string;
}

/** sensor_msgs/msg/NavSatStatus */
export interface RosNavSatStatus {
    status: number;
    service: number;
}

/** sensor_msgs/msg/NavSatFix */
export interface RosNavSatFix {
    header: RosHeader;
    status: RosNavSatStatus;
    latitude: number;
    longitude: number;
    altitude: number;
    position_covariance: number[];
    position_covariance_type: number;
}

/** sensor_msgs/msg/Imu */
export interface RosImu {
    header: RosHeader;
    orientation: RosQuaternion;
    orientation_covariance: number[];
    angular_velocity: RosVector3;
    angular_velocity_covariance: number[];
    linear_acceleration: RosVector3;
    linear_acceleration_covariance: number[];
}

/** nav_msgs/msg/Odometry (pose/twist without covariance wrappers simplified) */
export interface RosOdometry {
    header: RosHeader;
    child_frame_id: string;
    pose: { pose: RosPose; covariance: number[] };
    twist: { twist: RosTwist; covariance: number[] };
}
