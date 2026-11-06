/**
 * @file BatteryFailure.tsx
 * @description Shown in place of the battery levels when there is no reading from the
 * battery sensor: a crossed-out battery icon on top and a message below. Showing 0% here
 * instead would say the batteries are flat, when in fact their charge is unknown.
 *
 * @author Carson Fujita
 * @license MIT
 *
 * @example
 * ```tsx
 * <BatteryFailure />
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

import { Box, Typography, useTheme } from "@mui/material";
import BatteryFullIcon from "@mui/icons-material/BatteryFull";

/** Side length of the square the icon and its strike-through are drawn in, in pixels. */
const ICON_SIZE = 56;

/**
 * Reports that the battery sensor can't be reached.
 *
 * @returns A crossed-out battery icon above a message explaining the failure.
 */
export default function BatteryFailure() {
	const theme = useTheme();
	const color = theme.palette.error.main;

	return (
		<Box
			role="alert"
			sx={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				gap: 0.5,
				width: "96px",
				padding: 1,
			}}
		>
			{/* MUI has no crossed-out battery icon, so the strike is drawn over a full one. */}
			<Box
				aria-hidden="true"
				sx={{
					position: "relative",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					width: ICON_SIZE,
					height: ICON_SIZE,
				}}
			>
				<BatteryFullIcon sx={{ fontSize: ICON_SIZE, color, transform: "rotate(90deg)" }} />
				<Box
					data-testid="battery-failure-strike"
					sx={{
						position: "absolute",
						width: "100%",
						height: 4,
						borderRadius: 2,
						backgroundColor: color,
						// Keeps the strike readable where it crosses the icon of the same colour.
						boxShadow: `0 0 0 2px ${theme.palette.background.default}`,
						transform: "rotate(-45deg)",
					}}
				/>
			</Box>
			<Typography
				variant="caption"
				sx={{ color, fontWeight: 700, lineHeight: 1.2, textAlign: "center" }}
			>
				Failed to connect to battery sensor
			</Typography>
		</Box>
	);
}
