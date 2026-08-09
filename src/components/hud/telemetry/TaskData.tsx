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

import { useSelector } from "react-redux";
import type { RootState } from "../../../store/store";
import { Box, Typography, Chip } from "@mui/material";
import { useTheme } from "@mui/material/styles";

const fmt = (n: number) => n.toFixed(2);

function DataRow({ label, value }: { label: string; value: string }) {
	const theme = useTheme();
	return (
		<Box sx={{ display: "flex", gap: "4px", alignItems: "baseline" }}>
			<Typography sx={{ fontSize: "9px", color: theme.palette.telemetry?.text.secondary, minWidth: 60 }}>
				{label}
			</Typography>
			<Typography sx={{ fontSize: "10px", color: theme.palette.telemetry?.text.primary, fontFamily: "monospace" }}>
				{value}
			</Typography>
		</Box>
	);
}

export default function TaskData() {
	const theme = useTheme();
	const taskData = useSelector((state: RootState) => state.telemetry.task.data);
	const zed = useSelector((state: RootState) => state.telemetry.zed);
	const topics = useSelector((state: RootState) => state.telemetry.system.topics);
	const frameRate = useSelector((state: RootState) => state.connection.frameRate);
	const framesReceived = useSelector((state: RootState) => state.connection.framesReceived);
	const isConnected = useSelector((state: RootState) => state.connection.status === 'connected');

	// null means "no socket / not measurable yet" and is shown as a dash. Zero means the
	// socket is open but nothing is coming down it, which is a fault worth colouring.
	const feedColor = !isConnected || frameRate === null
		? theme.palette.telemetry?.text.secondary
		: frameRate < 1
			? theme.palette.error.main
			: frameRate < 4
				? theme.palette.warning.main
				: theme.palette.success.main;

	const getStatusColor = (status: string | undefined) => {
		switch (status) {
			case "autonomous": return "success";
			case "remote":     return "info";
			case "standby":    return "warning";
			case "out of control": return "error";
			default:           return "default";
		}
	};

	const sectionLabel = (text: string) => (
		<Typography sx={{ fontSize: "9px", fontWeight: "bold", color: theme.palette.telemetry?.text.secondary, textTransform: "uppercase", mt: 0.5 }}>
			{text}
		</Typography>
	);

	return (
		<Box
			sx={{
				width: "100%",
				height: "100%",
				backgroundColor: theme.palette.telemetry?.background.primary,
				border: `2px solid ${theme.palette.telemetry?.border.light}`,
				borderRadius: "8px",
				padding: "12px",
				display: "flex",
				flexDirection: "column",
				gap: "6px",
				overflow: "hidden",
			}}
		>
			<Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
			<Typography
				variant="caption"
				sx={{ fontWeight: "bold", color: theme.palette.telemetry?.text.primary, fontSize: "10px", textTransform: "uppercase" }}
			>
				Task Data
			</Typography>

			{/* Task status */}
			{taskData ? (
				<Box sx={{ display: "flex", alignItems: "center", gap: "6px" }}>
					<Typography variant="caption" sx={{ fontSize: "10px", color: theme.palette.telemetry?.text.primary, fontWeight: "bold" }}>
						Status:
					</Typography>
					<Chip
						label={taskData.status || "Unknown"}
						size="small"
						color={getStatusColor(taskData.status)}
						variant="outlined"
						sx={{ height: "20px", fontSize: "10px" }}
					/>
				</Box>
			) : (
				<Typography variant="caption" sx={{ color: theme.palette.telemetry?.text.secondary, fontSize: "10px" }}>
					No task data
				</Typography>
			)}

			{/* Data feed — telemetry frames arriving from the basestation. */}
			{sectionLabel("Data Feed")}
			<Box sx={{ display: "flex", gap: "4px", alignItems: "baseline" }}>
				<Typography sx={{ fontSize: "9px", color: theme.palette.telemetry?.text.secondary, minWidth: 60 }}>
					rate
				</Typography>
				<Typography sx={{ fontSize: "10px", color: feedColor, fontFamily: "monospace", fontWeight: "bold" }}>
					{isConnected && frameRate !== null ? `${frameRate.toFixed(1)} f/s` : "—"}
				</Typography>
			</Box>
			<DataRow label="frames" value={isConnected ? framesReceived.toLocaleString() : "—"} />

			{/* ZED Odometry */}
			{sectionLabel("ZED Odometry")}
			<DataRow label="pos x"   value={fmt(zed.odom.position.x)} />
			<DataRow label="pos y"   value={fmt(zed.odom.position.y)} />
			<DataRow label="pos z"   value={fmt(zed.odom.position.z)} />
			<DataRow label="roll"    value={`${fmt(zed.odom.orientation.roll)}°`} />
			<DataRow label="pitch"   value={`${fmt(zed.odom.orientation.pitch)}°`} />
			<DataRow label="yaw"     value={`${fmt(zed.odom.orientation.yaw)}°`} />

			{/* ZED Camera */}
			{sectionLabel("ZED Camera")}
			<Box sx={{ display: "flex", alignItems: "center", gap: "6px" }}>
				<Typography sx={{ fontSize: "9px", color: theme.palette.telemetry?.text.secondary, minWidth: 60 }}>active</Typography>
				<Box sx={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: zed.camera.active ? theme.palette.success.main : theme.palette.error.main }} />
			</Box>
			{zed.camera.active && (
				<>
					<DataRow label="resolution" value={`${zed.camera.width}×${zed.camera.height}`} />
					<DataRow label="encoding"   value={zed.camera.encoding || "—"} />
				</>
			)}

			{/* Detected Objects */}
			{sectionLabel(`Objects (${zed.objects.length})`)}
			{zed.objects.length === 0 ? (
				<Typography sx={{ fontSize: "10px", color: theme.palette.telemetry?.text.secondary }}>None</Typography>
			) : (
				zed.objects.map((obj, i) => (
					<Box key={i} sx={{ display: "flex", gap: "6px", alignItems: "baseline" }}>
						<Typography sx={{ fontSize: "10px", color: theme.palette.telemetry?.text.primary, fontWeight: "bold", minWidth: 60 }}>
							{obj.label}
						</Typography>
						<Typography sx={{ fontSize: "9px", color: theme.palette.telemetry?.text.secondary, fontFamily: "monospace" }}>
							{(obj.confidence * 100).toFixed(0)}% @ ({fmt(obj.position.x)}, {fmt(obj.position.y)}, {fmt(obj.position.z)})
						</Typography>
					</Box>
				))
			)}

			{/* Services / Topics */}
			{sectionLabel(`Services / Topics (${topics.length})`)}
			{topics.length === 0 ? (
				<Typography sx={{ fontSize: "10px", color: theme.palette.telemetry?.text.secondary }}>None</Typography>
			) : (
				topics.map((topic) => (
					<Typography
						key={topic}
						sx={{ fontSize: "9px", color: theme.palette.telemetry?.text.primary, fontFamily: "monospace" }}
					>
						{topic}
					</Typography>
				))
			)}
		</Box>
		</Box>
	);
}
