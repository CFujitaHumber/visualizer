/**
 * @file StatusIndicator.tsx
 * @description The vessel's operating-mode indicator: autonomous, remote control,
 * standby, or out of control.
 *
 * @remarks
 * The mode is derived from the ASV's physical mast light rather than from the
 * planner — see {@link selectIndicatorStatus} for why the `task` topic cannot
 * supply it. When the lamp is reporting, the dot is drawn in the lamp's OWN colour
 * rather than a palette entry, so what the dashboard shows and what a judge sees on
 * the mast are the same colour. The palette is the fallback for mock/simulation
 * runs, where there is no lamp.
 *
 * This exists so the four or five places that show vessel status stop each rolling
 * their own dot-and-label, which is how they came to disagree about what the status
 * even was.
 *
 * @author Carson Fujita
 * @license MIT
 */
import { Box, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useAppSelector } from "../../../store";
import { selectIndicatorStatus, selectLedColor } from "../../../store/selectors/telemetrySelectors";
import { TaskValues, type TaskStatus } from "../../../types/taskTypes";

/**
 * Human-readable labels. `TaskValues` uses terse wire strings ("remote"); the
 * indicator is read by judges and operators, so it spells them out.
 */
const STATUS_LABELS: Record<TaskStatus, string> = {
    [TaskValues.autonomous]: "Autonomous",
    [TaskValues.remote]: "Remote Control",
    [TaskValues.standby]: "Standby",
    [TaskValues.outOfControl]: "Out of Control",
    [TaskValues.lostConnection]: "Lost Connection",
    [TaskValues.simulator]: "Simulated",
};

export type StatusIndicatorProps = {
    /** Renders the dot alone, for tight spots like a map header. */
    dotOnly?: boolean;
    /** Dot diameter in px. */
    size?: number;
    /** Label font size. Ignored when `dotOnly`. */
    fontSize?: string | number;
    /** Draws a tinted pill behind the dot and label. */
    filled?: boolean;
};

/**
 * Displays the ASV's current operating mode.
 *
 * @param props - See {@link StatusIndicatorProps}.
 */
export default function StatusIndicator({
    dotOnly = false,
    size = 9,
    fontSize = "13px",
    filled = false,
}: StatusIndicatorProps) {
    const theme = useTheme();
    const status = useAppSelector(selectIndicatorStatus);
    const ledColor = useAppSelector(selectLedColor);

    // The lamp's measured colour wins; the palette covers mock/simulation, where
    // nothing is driving a mast light. Falling back again to the generic accent
    // matches how the rest of the telemetry HUD degrades when the palette is absent.
    const color = ledColor
        ?? theme.palette.status?.primary?.[status]
        ?? theme.palette.primary.main;

    const label = STATUS_LABELS[status] ?? status;

    return (
        <Box
            role="status"
            aria-label={`ASV status: ${label}`}
            sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                minWidth: 0,
                ...(filled
                    ? {
                        px: 1,
                        py: 0.25,
                        borderRadius: 999,
                        backgroundColor: alpha(color, 0.12),
                        border: `1px solid ${alpha(color, 0.4)}`,
                    }
                    : {}),
            }}
        >
            <Box
                sx={{
                    width: size,
                    height: size,
                    borderRadius: "50%",
                    backgroundColor: color,
                    flexShrink: 0,
                    // Reads as a lamp rather than a bullet point, and keeps the dot
                    // visible against the dark telemetry background at small sizes.
                    boxShadow: `0 0 ${size / 2}px ${alpha(color, 0.9)}`,
                }}
            />
            {!dotOnly && (
                <Typography
                    variant="caption"
                    sx={{
                        color,
                        fontSize,
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                    }}
                >
                    {label}
                </Typography>
            )}
        </Box>
    );
}
