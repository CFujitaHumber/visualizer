/**
 * @author Carson Fujita
 *
 * @description
 * This module serves as the central export point for all telemetry-related components in the ASV dashboard.
 * It aggregates various components that display different aspects of the ASV's telemetry data, such as battery levels, compass heading, signal strength, speed, and more.
 *
 * The components included in this module are:
 * - `Batteries`: Displays the battery levels for the ASV's motors and power system.
 * - `Compass`: Displays the compass heading of the ASV.
 * - `Log`: Displays a log of telemetry events and messages.
 * - `Map`: Displays the ASV's current location and path on a map.
 * - `PowerRudderPanel`: Displays the power levels and rudder positions for the ASV's motors.
 * - `SignalLog`: Displays a scrolling log of signal/comms events.
 * - `SignalStrength`: Displays the signal strength of the ASV's communication link.
 * - `Speedometer`: Displays the current speed of the ASV.
 * - `Task`: Displays information about the current task being performed by the ASV.
 * - `TaskData`: Displays detailed data related to the current task.
 *
 * The composed dashboard itself lives one level up as `TelemetryDashboard`
 * (exported from the package root) — it imports this barrel, so it must not be
 * re-exported here.
 */
import Batteries from "./Batteries";
import Compass from "./Compass";
import Log from "./Log";
import Map from "./Map";
import PowerRudderPanel from "./PowerRudderPanel";
import SignalLog from "./SignalLog";
import SignalStrength from "./SignalStrength";
import Speedometer from "./Speedometer";
import Task from "./Task";
import TaskData from "./TaskData";

export {
	Batteries,
	Compass,
	Log,
	Map,
	PowerRudderPanel,
	SignalLog,
	SignalStrength,
	Speedometer,
	Task,
	TaskData,
};

export { RadiusVisualizer, type RadiusVisualizerProps, type RadarObstacle } from "./RadiusVisualizer";
export { RadiusVisualizerPanel, type RadiusVisualizerPanelProps } from "./RadiusVisualizerPanel";
export { ShipRudderVisualizer, type ShipRudderVisualizerProps } from "./ShipRudderVisualizer";
export { ShipRudderVisualizerPanel, type ShipRudderVisualizerPanelProps } from "./ShipRudderVisualizerPanel";
export { TacticalMap, type TacticalMapProps } from "./TacticalMap";
export { TacticalMapPanel, type TacticalMapPanelProps } from "./TacticalMapPanel";
export { getPowerColor } from "./powerColor";
