/**
 * @file demo/DemoAppLive.tsx
 * @description Live-mode demo harness application for @humber-asv/visualizer.
 *
 * Unlike DemoApp.tsx (`bun run dev`), this boots the same way the production
 * Connect/Telemetry pages do: it dispatches `initConnection()` against the real
 * ASV basestation (ws://localhost:8080/telemetry by default — override via
 * `configureTelemetryConnection()` before mount if the basestation lives
 * elsewhere) and renders whatever the Redux store receives. There is no
 * njordTasksSim harness here — if the basestation is unreachable, the store
 * falls back to the library's own mock telemetry stream automatically.
 *
 * Not shipped to npm — the published package contains only `dist/`.
 */
import { useEffect, useState } from "react";
import { Box, Button, CircularProgress, Stack, Typography, Snackbar, Alert } from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
  TelemetryProvider,
  TelemetryThemeProvider,
  TelemetryDashboard,
  RadiusVisualizerPanel,
  ShipRudderVisualizerPanel,
  TacticalMapPanel,
} from "../src";
import {
  useAppDispatch,
  useAppSelector,
  initConnection,
  retryConnection,
  reconnect,
  startSimulation,
  dismissToast,
} from "../src/store";

function LiveInner() {
  const dispatch = useAppDispatch();
  const status = useAppSelector((state) => state.connection.status);
  const toast = useAppSelector((state) => state.connection.toast);
  const [isTacticalMapOpen, setIsTacticalMapOpen] = useState(false);

  useEffect(() => {
    dispatch(initConnection());
  }, [dispatch]);

  // Auto-retry the real connection whenever it falls back to mock data.
  useEffect(() => {
    if (status !== "mock") return;
    const timer = setTimeout(() => dispatch(retryConnection()), 5000);
    return () => clearTimeout(timer);
  }, [status, dispatch]);

  if (status === "idle" || status === "connecting") {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          gap: 2,
          bgcolor: "#0a0f1d",
          color: "#fff",
        }}
      >
        <CircularProgress sx={{ color: "#B980F1" }} />
        <Typography>Connecting to ASV basestation…</Typography>
      </Box>
    );
  }

  if (status === "failed") {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          gap: 3,
          bgcolor: "#0a0f1d",
          color: "#fff",
        }}
      >
        <WarningAmberIcon sx={{ fontSize: 48, color: "#ef4444" }} />
        <Typography variant="h6">Failed to connect to basestation</Typography>
        <Box sx={{ display: "flex", gap: 2 }}>
          <Button variant="contained" onClick={() => dispatch(reconnect())}>
            Reconnect
          </Button>
          <Button
            variant="outlined"
            sx={{ borderColor: "#ef4444", color: "#ef4444" }}
            onClick={() => dispatch(startSimulation())}
          >
            Use Simulation Data
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ position: "relative", width: "100%", minHeight: "100vh" }}>
      <Box data-testid="dashboard-root">
        <TelemetryDashboard
          title={status === "mock" ? "Live Log (fallback: simulation)" : "Live Log"}
          placeholderSrc="/main_example_background.png"
        />
      </Box>

      {/* Overlay column: RadiusVisualizer / ShipRudderVisualizer panel previews */}
      <Stack
        spacing={1.5}
        sx={{
          position: "absolute",
          top: 96,
          right: 16,
          zIndex: 10,
          alignItems: "flex-end",
        }}
      >
        <RadiusVisualizerPanel onClick={() => setIsTacticalMapOpen(true)} />
        <ShipRudderVisualizerPanel />
      </Stack>

      <Box
        data-testid="live-status-badge"
        sx={{
          position: "absolute",
          top: 16,
          left: 16,
          zIndex: 10,
          px: 1.5,
          py: 0.5,
          borderRadius: 1,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 1,
          color: "#fff",
          bgcolor: status === "connected" ? "rgba(16,185,129,0.85)" : "rgba(245,158,11,0.85)",
        }}
      >
        {status === "connected" ? "LIVE" : "SIMULATION FALLBACK"}
      </Box>

      <TacticalMapPanel open={isTacticalMapOpen} onClose={() => setIsTacticalMapOpen(false)} />

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => dispatch(dismissToast())}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={() => dispatch(dismissToast())} severity={toast.severity} variant="filled" sx={{ width: "100%" }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export function DemoAppLive() {
  return (
    <TelemetryProvider>
      <TelemetryThemeProvider>
        <LiveInner />
      </TelemetryThemeProvider>
    </TelemetryProvider>
  );
}
