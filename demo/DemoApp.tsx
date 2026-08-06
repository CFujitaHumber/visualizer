/**
 * @file demo/DemoApp.tsx
 * @description Demo harness application for @humber-asv/visualizer.
 *
 * Boots straight into simulation mode (no basestation required) and renders the
 * TelemetryDashboard with the RadiusVisualizer / ShipRudderVisualizer panels
 * overlaid, plus sim controls. Stable data-testids are exposed for the
 * selenium-webdriver e2e suite.
 *
 * Not shipped to npm — the published package contains only `dist/`.
 */
import React, { useEffect, useRef, useState } from "react";
import { Box, Button, Stack } from "@mui/material";
import {
  TelemetryProvider,
  TelemetryThemeProvider,
  TelemetryDashboard,
  RadiusVisualizerPanel,
  ShipRudderVisualizerPanel,
} from "../src";
import { useAppDispatch } from "../src/store";
import { generateRandomState, generateMockStateUpdate, setTaskIndex, getTaskIndex, setManualMode, getManualMode, manualControls, setSimRunning, getSimRunning } from "../src/utils/njordTasksSim";
import { SET_STATUS } from "../src/store/slices/telemetrySlice";

function DemoInner() {
  const dispatch = useAppDispatch();
  const simStateRef = useRef<any>(null);
  const [isManual, setIsManual] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    // Initial State
    setTaskIndex(0); // Default to calibration
    setManualMode(false);
    simStateRef.current = generateRandomState();
    dispatch(SET_STATUS(simStateRef.current));

    // Keyboard controls for manual mode
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!getManualMode()) return;
      const step = 0.5;
      if (e.key === 'w' || e.key === 'ArrowUp') manualControls.targetSpeed = Math.min(5, manualControls.targetSpeed + step);
      if (e.key === 's' || e.key === 'ArrowDown') manualControls.targetSpeed = Math.max(0, manualControls.targetSpeed - step);
      if (e.key === 'a' || e.key === 'ArrowLeft') manualControls.rudderPct = -30;
      if (e.key === 'd' || e.key === 'ArrowRight') manualControls.rudderPct = 30;
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (!getManualMode()) return;
      if (e.key === 'a' || e.key === 'ArrowLeft' || e.key === 'd' || e.key === 'ArrowRight') manualControls.rudderPct = 0;
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Start the prototype sim
    const interval = setInterval(() => {
      simStateRef.current = generateMockStateUpdate(simStateRef.current);
      dispatch(SET_STATUS(simStateRef.current));
      
      const simStatus = getSimRunning();
      setIsRunning(prev => {
        if (prev !== simStatus) return simStatus;
        return prev;
      });
    }, 33);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [dispatch]);

  return (
    <Box sx={{ position: "relative", width: "100%", minHeight: "100vh" }}>
      <Box data-testid="dashboard-root">
        <TelemetryDashboard title="Demo Log" placeholderSrc="/main_example_background.png" />
      </Box>

      {/* Sim controls moved above Propulsion */}
      <Stack
        spacing={1.5}
        sx={{
          position: "absolute",
          bottom: 210,
          right: 20,
          width: 230,
          zIndex: 10,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Button
          data-testid="start-pause-btn"
          size="small"
          variant="outlined"
          style={{ borderColor: isRunning ? '#10b981' : '#B980F1', color: isRunning ? '#10b981' : '#B980F1' }}
          onClick={() => {
            const nextState = !isRunning;
            setSimRunning(nextState);
            setIsRunning(nextState);
          }}
        >
          {isRunning ? 'Pause Sim' : 'Start Sim'}
        </Button>
        <Button
          data-testid="start-sim-btn"
          size="small"
          variant="outlined"
          onClick={() => {
            setTaskIndex(0); // Reset to Calibration
            setManualMode(false);
            setIsManual(false);
            simStateRef.current = generateRandomState();
            dispatch(SET_STATUS(simStateRef.current));
          }}
        >
          Restart Sim
        </Button>
        <Button
          data-testid="regenerate-map"
          size="small"
          variant="outlined"
          onClick={() => {
            const oldState = simStateRef.current;
            
            // Advance task
            const nextTask = setTaskIndex(getTaskIndex() + 1);
            
            const newState = generateRandomState();
            
            // Preserve the log history and mapped obstacles (clear the blue trail so it doesn't linger at spawn)
            newState.task.log = [...oldState.task.log, ...newState.task.log].slice(-10);
            newState.zed.objects = oldState.zed.objects;
            
            // PRESERVE the physical ASV location!
            newState.asv = { ...oldState.asv };
            
            simStateRef.current = newState;
            dispatch(SET_STATUS(newState));
          }}
        >
          Next Task
        </Button>
        <Button
          data-testid="manual-toggle-btn"
          size="small"
          variant="outlined"
          style={{ borderColor: isManual ? '#f59e0b' : '', color: isManual ? '#f59e0b' : '' }}
          onClick={() => {
            const newMode = !getManualMode();
            setManualMode(newMode);
            setIsManual(newMode);
            
            if (newMode) {
              // Adopt current heading/speed to avoid jumping
              manualControls.targetSpeed = simStateRef.current.asv.speed;
              manualControls.targetHeading = simStateRef.current.asv.heading;
            }
          }}
        >
          {isManual ? 'MANUAL ON (WASD)' : 'MANUAL OFF'}
        </Button>
      </Stack>
    </Box>
  );
}

export function DemoApp() {
  return (
    <TelemetryProvider>
      <TelemetryThemeProvider>
        <DemoInner />
      </TelemetryThemeProvider>
    </TelemetryProvider>
  );
}
