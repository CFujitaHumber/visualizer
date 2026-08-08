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
import { Box, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
export default function Speedometer() {
	const theme = useTheme();
	const speed = useSelector((state: RootState) => state.telemetry.asv.speed);

	// Determine gauge color based on speed
	const getGaugeColor = () => {
		if (speed < 1) return "#3b82f6"; // Blue - slow
		if (speed < 3) return "#10b981"; // Green - moderate
		if (speed < 4) return "#eab308"; // Yellow - fast
		return "#ef4444"; // Red - very fast
	};

	return (
		// A fixed width paired with a parent-driven height (the old "width: 8rem,
		// height: 100%") stretches into whatever aspect ratio the consumer's grid
		// cell happens to have. Owning a stable aspectRatio instead means this tile
		// always renders as a consistent square regardless of what size/shape the
		// parent gives it, and container query units (cqw) size the text off the
		// tile's own rendered width so "12.34" never overflows or looks stretched.
		// min width and max width keep the tile from getting too small or too large
		<Box
			sx={{
				containerType: "inline-size",
				width: "100%",
				maxWidth: "8rem",
				minWidth: "4rem",
				aspectRatio: "1 / 1",
				borderRadius: 2,
				backgroundColor: theme.palette.telemetry?.background.primary,
				border: `1px solid ${theme.palette.telemetry?.border.light}`,
				padding: "10px",
				display: "flex",
				flexDirection: "column",
				gap: "3px",
			}}
		>
			{/* speed */}
			<Typography
				variant="h4"
				sx={{
					textAlign: "center",
					fontWeight: "bold",
					color: getGaugeColor(),
					fontSize: "clamp(1.25rem, 22cqw, 2.75rem)",
					lineHeight: 1.1,
				}}
			>
				{speed.toFixed(2)}
			</Typography>

			{/* Units */}
			<Box sx={{ textAlign: "center",
				flex: 1,
				display: "flex",
				alignItems: "center",
				justifyContent: "center"
			}}>

				<Typography
					sx={{
						color: theme.palette.text.primary,
						fontSize: "clamp(0.65rem, 8cqw, 1rem)",
						marginLeft: "4px",
					}}
				>
					m/s
				</Typography>
			</Box>
		</Box>
	);
}