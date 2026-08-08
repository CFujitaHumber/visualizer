## Plan: Fix visualizer telemetry + HUD TODO bugs

TL;DR: The most likely root cause is inconsistent handling of ZED object coordinates and telemetry ingestion. The fix should focus on making boat-relative vs world-frame state explicit, restoring lat/lon and course-trail updates, repairing map rendering for minimap/technical/tactical views, stabilizing fog/grid behavior, and improving responsive layout.

**Steps**
1. Diagnose and fix ZED coordinate handling.
   - Confirm `telemetrySlice` is projecting `zed.objects` only once and that the store contains world-frame positions used by BigMap/TacticalMap.
   - Fix `RadiusVisualizerPanel.tsx` and any other local-radar consumers that currently treat `telemetry.zed.objects` as boat-relative when the slice already projects them.
   - If needed, preserve both raw boat-relative detections and projected world-frame detections in state to avoid misuse.

2. Restore latitude/longitude and course-trail update behavior.
   - Verify `connectionActions.ts` / `fetchTelemetry.ts` dispatch live payload fields correctly into `telemetry.asv` and `telemetry.zed.odom`.
   - Update mock telemetry generation so `asv.latitude`/`longitude` are non-zero and COG/heading values evolve naturally.
   - Ensure `TacticalMapPanel.tsx` properly appends `courseTrail` points from live odometry and resets on teleport/reconnect conditions.

3. Fix tactical/technical minimap object rendering.
   - Ensure `BigMap.tsx`, `TacticalMap.tsx`, and any technical/minimap components read the same object array and render world-frame obstacles.
   - Validate that object markers are not filtered out by stale coordinate assumptions or by incorrect label/color mapping.

4. Repair global/local fog and grid behavior.
   - Review `MappingScene.tsx` reveal logic, especially `revealGlobalAroundPosition` and live `revealAllKnownCells` handling.
   - Confirm the vessel’s position-to-global-cell conversion matches the actual world/frame used by the map.
   - Verify `discoveredGridSlice.ts` state transitions so VISIBLE cells demote to VISITED correctly and obstacle overrides are applied only when fineGrid cells overlap.

5. Improve mobile responsiveness.
   - Audit `TelemetryDashboard.tsx`, HUD panel wrappers, and scene layout for hard-coded widths/heights or non-responsive panel stacking.
   - Use MUI breakpoints and responsive sizing to keep camera/radar/status cards usable on smaller screens.
   - Ensure the map overlay, bottom nav, and panel toggles adapt gracefully to portrait and landscape mobile views.

6. Standardize connection and mock fallback semantics.
   - Treat `connection.status` as the source of truth for live vs mock mode in `TelemetryDashboard.tsx`, `SceneHUD.tsx`, and relevant panel components.
   - Verify `initConnection`, `retryConnection`, `fallbackToMock`, `startMockTelemetryUpdates`, and `regenerateMockTelemetry` all maintain consistent state and discovery reset semantics.
   - Fix any mismatch where UI components rely on `signal.strength` instead of connection state.

**Relevant files**
- `visualizer/src/store/slices/telemetrySlice.ts`
- `visualizer/src/types/statusTypes.ts`
- `visualizer/src/store/actions/connectionActions.ts`
- `visualizer/src/store/actions/fetchTelemetry.ts`
- `visualizer/src/store/slices/discoveredGridSlice.ts`
- `visualizer/src/store/slices/connectionSlice.ts`
- `visualizer/src/store/slices/videoSlice.ts`
- `visualizer/src/utils/geo.ts`
- `visualizer/src/utils/telemetry/telemetryFactory.ts`
- `visualizer/src/components/hud/telemetry/RadiusVisualizerPanel.tsx`
- `visualizer/src/components/hud/telemetry/BigMap.tsx`
- `visualizer/src/components/hud/telemetry/TacticalMap.tsx`
- `visualizer/src/components/hud/telemetry/TacticalMapPanel.tsx`
- `visualizer/src/components/TelemetryDashboard.tsx`
- `visualizer/src/components/scenes/MappingScene.tsx`
- `visualizer/src/components/scenes/SceneRenderer.tsx`
- `visualizer/src/components/scenes/SceneCanvas.tsx`

**Verification**
1. Run existing unit tests for `telemetrySlice`, `TacticalMap`, and any HUD component tests.
2. Manually exercise the app in both live and mock modes to confirm:
   - ZED objects appear on minimap, tactical map, and technical map views.
   - latitude/longitude display non-zero values in live/mock telemetry.
   - the course trail is appended and visible on TacticalMap.
   - course-over-ground / heading geometry renders correctly.
   - fog-of-war & global/local grid reveal behaves predictably.
   - the layout works on mobile/portrait and desktop.
3. Check fallback mode and reconnect flows to ensure simulated telemetry still drives the same visualizations.

**Decisions / assumptions**
- The main bug is a telemetry-frame mismatch: the frontend projects ZED detections to world coordinates, but some consumers still expect boat-relative coordinates.
- Mobile issues are likely due to rigid dashboard layout rather than core canvas rendering.
- The existing HUD/map components are usable; the work is primarily wiring and state consistency.
