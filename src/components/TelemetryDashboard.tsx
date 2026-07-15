/**
 * @file TelemetryDashboard.tsx
 *
 * @description
 * This component serves as the main telemetry dashboard for the ASV.
 * It aggregates various telemetry components such as the map, speedometer, compass, task information, battery levels, signal strength, and a live log of telemetry events.
 * The dashboard is designed to provide a comprehensive overview of the ASV's status and performance in real-time.
 *
 * @author Carson Fujita
 * @license MIT
 *
 * @remarks
 * - The component uses React and Material-UI for the user interface, and Redux for state management.
 * - It includes a background image stream from the ASV, overlaid with telemetry data and a collapsible log drawer at the bottom.
 * - When there is no stream and no `placeholderSrc` prop, a themed empty background is shown instead.
 * - The dashboard is responsive, with adjustments for mobile and desktop views.
 * - The border color of the dashboard changes based on the ASV's status to provide a quick visual indicator of its condition.
 * @example
 * ```tsx
 * <TelemetryDashboard placeholderSrc={fallbackJpg} title="Live Log" />
 * ```
 */
/*
MIT License

Copyright (c) 2026 HumberASV
Copyright (c) 2026 Carson Fujita

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import { Map, Speedometer, Compass, Task, Batteries, TaskData, PowerRudderPanel, SignalStrength } from "./hud/telemetry";
import SignalLog from "./hud/telemetry/SignalLog";
import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "../store/store";
import { useEffect, useState } from "react";
import { Box, useTheme, Typography } from "@mui/material";

import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import { retryConnection } from "../store/actions/connectionActions";
import type { TaskStatus } from "../types";

export interface TelemetryDashboardProps {
	/** Image shown behind the dashboard when no video stream is available. */
	placeholderSrc?: string;
	/** Label of the collapsible log drawer header. */
	title?: string;
}

const TelemetryDashboard: React.FC<TelemetryDashboardProps> = ({ placeholderSrc, title = "Live Log Laugh" }) => {
	const theme = useTheme();
	const connectionStatus = useSelector((state: RootState) => state.connection.status);
	const dispatch = useDispatch<AppDispatch>();
	const [drawerCollapsed, setDrawerCollapsed] = useState(false);

	// Retry the real connection whenever it falls back to mock mode.
	useEffect(() => {
		if (connectionStatus !== "mock") return;

		const timer = setTimeout(() => {
			dispatch(retryConnection());
		}, 5000);

		return () => clearTimeout(timer);
	}, [connectionStatus, dispatch]);

	const renderMap = () => {
		if (hasGridData) {
			return <Map />;
		}

		return <div>Loading telemetry...</div>;
	};


	const imageStream = useSelector((state: RootState) => state.video.streamUrl || "");
	const occupancyGrid = useSelector((state: RootState) => state.telemetry.map.occupancyGrid);
	const navigationGrid = useSelector((state: RootState) => state.telemetry.map.navigationGrid);
	const status = useSelector((state: RootState) => state.telemetry.planning.status || "idle");
	const hasGridData = occupancyGrid && navigationGrid;

	const borderColor = theme.palette.status.primary[status as TaskStatus];
	
	return (
		<Box sx={{ position: "relative", width: "100%", height: "100vh", overflow: "auto", backgroundColor: theme.palette.background.default }}>
			{/* Background image stream from the ASV */}
            <Box
				sx={{
					position: "absolute",
					top: 0,
					left: 0,
					width: "100%",
					height: "100%",
					overflow: "hidden",
					zIndex: 0,
				}}
			>
				{imageStream || placeholderSrc ? (
					<Box
						component="img"
						src={imageStream || placeholderSrc}
						alt=""
						sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
					/>
				) : (
					<Box sx={{ width: "100%", height: "100%", backgroundColor: theme.palette.telemetry?.background.empty }} />
				)}
			</Box>
            {/* Semi-transparent overlay to darken the background for better contrast
             Also primary wrapper for all telemetry elements, with a border color that reflects the ASV's status */}
			<Box
				sx={{
					position: "relative",
					zIndex: 1,
					width: "100%",
					height: "100%",
					display: "flex",
					flexDirection: "column",
					border: `4px solid ${borderColor}`,
					boxSizing: "border-box",
					backgroundColor: theme.palette.telemetry?.background.overlay,
					transition: "border-color 0.3s ease-out",
				}}
			>
				<Box sx={{ display: { xs: "none", md: "flex" }, gap: 1, p: 0.75, alignItems: "stretch" }}>
					<Box sx={{ order: { xs: 1, md: 1 } }}>
						<Speedometer />
					</Box>
                    <Box sx={{ flex: 0, order: { xs: 1, md: 2 }, minWidth: "10%" }}>
                        <Task />
                    </Box>
					<Box sx={{ flex: 1, minWidth: 0, order: { xs: 1, md: 2 }, flexGrow: 1 }}>
						<Compass />
					</Box>
					<Box sx={{ 
                        order: { xs: 1, md: 3 }, 
                        backgroundColor: theme.palette.telemetry?.background.primary,
                        border: `1px solid ${theme.palette.telemetry?.border.light}`,
                        borderRadius: 2,
                        padding: 1,
                        display: "flex",
                        flexDirection: "row",
                        justifyContent: "center",
                        alignItems: "center",
                        gap: 10,
                }}>
                        <SignalStrength size={15} />
						<Batteries />
					</Box>
				</Box>

                {/* Mobile view - stack the speedometer and cog heading vertically, and hide the batteries */}
				<Box sx={{ display: { xs: "flex", md: "none" }, gap: 0.5, px: 0.5, pt: 0.5, pb: 0.25, alignItems: "stretch" }}>
					<Box sx={{ flex: 1, minWidth: 0 }}>
						<Compass />
					</Box>
				</Box>

				<Box sx={{ display: { xs: "flex", md: "none" }, gap: 0.5, px: 0.5, pb: 0.25, alignItems: "stretch"}}>
					<Box sx={{ flex: 1, minWidth: 0 }}>
						<Speedometer />
					</Box>
					<Box sx={{ flex: 1, minWidth: 0 }}>
						<Batteries />
					</Box>
				</Box>

				{/* Center spacer pushes the drawer to the bottom */}
				<Box sx={{ flex: 1, minWidth: 0, px: { xs: 0.5, md: 1.5 }, pt: 0.25, pb: 0.25, overflow: "hidden" }}>
					<Box sx={{ height: { xs: "1vh", md: "6vh" }}} />
				</Box>

                <Box sx={{ display: "flex", flexDirection: "row", flexAlign: "stretch" }}>

                    <Box sx={{ width: 260, flexShrink: 0,}}>
                        <PowerRudderPanel />
                    </Box>

                    <Box sx={{ flex: 1, minWidth: 0}}>
                        <TaskData />
                    </Box>

                    <Box sx={{ width: 250, flexShrink: 0 }}>
                        {renderMap()}
                    </Box>
                </Box>

				{/* Bottom drawer pinned to the bottom of the dashboard */}
				<Box sx={{ flex: "0 0 auto", backgroundColor: theme.palette.telemetry?.background.primary, textAlign: "center", fontSize: "12px", color: borderColor }}>
					<Box sx={{ display: "flex", flexDirection: "column", overflow: "hidden", alignItems: "stretch" }}>
						<Box
							sx={{
								width: "100%",
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between",
								px: 1,
								py: 0.5,
								cursor: "pointer",
								userSelect: "none",
								backgroundColor: theme.palette.telemetry?.background.header,
								borderBottom: drawerCollapsed ? "none" : `1px solid ${theme.palette.telemetry?.border.lighter}`,
								flexShrink: 0,
							}}
							onClick={() => setDrawerCollapsed((value) => !value)}
						>
							<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
								<Box sx={{ width: 10, height: 10, borderRadius: "999px", backgroundColor: borderColor }} />
								<Typography sx={{ fontSize: 12, fontWeight: 700, color: theme.palette.text.primary }}>
									{title}
								</Typography>
							</Box>
							<Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: theme.palette.telemetry?.text.secondary }}>
								<Box sx={{ fontSize: 11, fontWeight: 700 }}>{drawerCollapsed ? "Expand" : "Collapse"}</Box>
								{drawerCollapsed ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
							</Box>
						</Box>
						{!drawerCollapsed && <SignalLog width="100%" height="100%" />}
					</Box>
				</Box>
			</Box>
		</Box>
	);
};

export default TelemetryDashboard;
