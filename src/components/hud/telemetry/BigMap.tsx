import React, { useEffect, useRef } from 'react';
import { useTheme, alpha } from '@mui/material/styles';
import type { RootState } from '../../../store/store';
import { useAppSelector } from '../../../store';
import { selectVesselLocalMeters, selectZedObjectsWorld } from '../../../store/selectors/telemetrySelectors';
import { catamaranSvgStr } from '../../../assets/svgSources';
import {
  ROBOT_LENGTH_M,
  ROBOT_WIDTH_M,
  FOV_RADIUS_M,
  FOV_HALF_ANGLE_RAD,
  MIN_BOAT_ICON_PX,
  OBJECT_COLOR_KEYS,
  DEFAULT_OBJECT_COLOR_KEY,
} from '../../../utils/robot';

export const BigMap: React.FC = () => {
  const theme = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boatImgRef = useRef<HTMLImageElement | null>(null);
  const mapBoundsRef = useRef({ minX: -25, maxX: 25, minY: -25, maxY: 25 });

  // occupancyGrid/navigationGrid aren't read here: Map.tsx's MapComponent already
  // renders them elsewhere, and the basestation has no live publisher for either
  // yet (see the `map` group in statusTypes.ts) — BigMap shows a lightweight
  // procedural grid plus the swept-area wedge below instead.
  // Same shared local-meters frame TacticalMap and the course trail use — see
  // selectVesselLocalMeters for why this isn't zed.odom.position.
  const ZedObjects = useAppSelector(selectZedObjectsWorld);
  const odom = useAppSelector(selectVesselLocalMeters);
  const headingASV = useAppSelector((state: RootState) => state.telemetry.asv.heading);
  const pathASV = useAppSelector((state: RootState) => state.telemetry.map.courseTrail);

  // Mirrored into refs so the rAF render loop below (started once on mount, see
  // the effect's comment) always reads live Redux state instead of the values
  // captured in its closure at first render.
  const zedObjectsRef = useRef(ZedObjects);
  const odomRef = useRef(odom);
  const headingRef = useRef(headingASV);
  const pathRef = useRef(pathASV);
  const themeRef = useRef(theme);
  useEffect(() => {
    zedObjectsRef.current = ZedObjects;
    odomRef.current = odom;
    headingRef.current = headingASV;
    pathRef.current = pathASV;
    themeRef.current = theme;
  }, [ZedObjects, odom, headingASV, pathASV, theme]);

  useEffect(() => {
    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(catamaranSvgStr);
    img.onload = () => { boatImgRef.current = img; };
  }, []);

  // Render Loop. This is very similar to TacticalMap's render loop — both read
  // live state via refs and share the same lerp/teleport-snap camera approach —
  // but BigMap uses a deadzone-pan + max-zoom camera (always-auto, no manual
  // gestures, background/ambient layer) while TacticalMap uses a bbox-fit camera
  // with a manual pan/zoom override, so they aren't easily unified into one hook.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    let smoothX = odomRef.current.x;
    let smoothY = odomRef.current.y;
    let smoothHeading = headingRef.current;

    let smoothScale = 0;
    let cameraCX = 0;
    let cameraCY = 0;
    let isCameraInit = false;

    const render = () => {
      const ZedObjects = zedObjectsRef.current;
      const odom = odomRef.current;
      const headingASV = headingRef.current;
      const pathASV = pathRef.current;

      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect && (canvas.width !== rect.width || canvas.height !== rect.height)) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }

      if (canvas.width === 0 || canvas.height === 0) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      const targetX = odom.x;
      const targetY = odom.y;
      const targetH = headingASV;

      // Detect teleport (e.g. initial connection) and snap instead of lerping
      if (Math.hypot(targetX - smoothX, targetY - smoothY) > 50) {
        smoothX = targetX;
        smoothY = targetY;
        smoothHeading = targetH;
        // Also reset bounds to zoom back in if the sim restarted!
        mapBoundsRef.current = { minX: -25, maxX: 25, minY: -25, maxY: 25 };
        smoothScale = 0;
        isCameraInit = false;
      } else {
        // Fast lerp to track the 30Hz Redux state perfectly
        smoothX += (targetX - smoothX) * 0.3;
        smoothY += (targetY - smoothY) * 0.3;

        let diff = targetH - smoothHeading;
        while (diff < -180) diff += 360;
        while (diff > 180) diff -= 360;
        smoothHeading += diff * 0.3;
      }

      const currentX = smoothX;
      const currentY = smoothY;
      const heading = smoothHeading;

      if (Number.isNaN(currentX) || Number.isNaN(currentY) || Number.isNaN(heading)) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // We will calculate scale dynamically further down based on cameraCX
      const maxZoomScale = Math.min((canvas.width / 2) / 80, (canvas.height / 2) / 80);
      let targetScale = maxZoomScale; // Start with max zoom

      // Calculate view dimensions to create a panning deadzone
      // We want the FOV cone (40m) to comfortably fit before panning
      const viewW = canvas.width / (smoothScale || 1);
      const viewH = canvas.height / (smoothScale || 1);
      const marginX = Math.max(0, (viewW / 2) - 60);
      const marginY = Math.max(0, (viewH / 2) - 60);

      if (!isCameraInit) {
        cameraCX = currentX;
        cameraCY = currentY;
        isCameraInit = true;
      }

      if (currentX > cameraCX + marginX) cameraCX = currentX - marginX;
      if (currentX < cameraCX - marginX) cameraCX = currentX + marginX;
      if (currentY > cameraCY + marginY) cameraCY = currentY - marginY;
      if (currentY < cameraCY - marginY) cameraCY = currentY + marginY;

      // Now that cameraCX is updated, check if obstacles or boat are near the real screen edges.
      // If they are, we need to zoom out so they fit!
      let maxViewDistX = Math.abs(currentX - cameraCX) + 60;
      let maxViewDistY = Math.abs(currentY - cameraCY) + 60;

      // Ensure all mapped obstacles remain on screen
      ZedObjects.forEach(obs => {
        const x = obs.position.x;
        const y = obs.position.y;
        maxViewDistX = Math.max(maxViewDistX, Math.abs(x - cameraCX) + FOV_RADIUS_M);
        maxViewDistY = Math.max(maxViewDistY, Math.abs(y - cameraCY) + FOV_RADIUS_M);
      });

      // Ensure the entire mapped blue trail remains on screen
      pathASV.forEach(pt => {
        maxViewDistX = Math.max(maxViewDistX, Math.abs(pt.x - cameraCX) + FOV_RADIUS_M);
        maxViewDistY = Math.max(maxViewDistY, Math.abs(pt.y - cameraCY) + FOV_RADIUS_M);
      });

      const fitScale = Math.min((canvas.width / 2) / maxViewDistX, (canvas.height / 2) / maxViewDistY);
      targetScale = Math.min(fitScale, maxZoomScale);

      if (smoothScale === 0) {
        smoothScale = targetScale;
      } else {
        // Smoothly interpolate scale
        smoothScale += (targetScale - smoothScale) * 0.05;
      }

      const scale = smoothScale || 1;

      const centerX = cameraCX;
      const centerY = cameraCY;

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(scale, -scale);
      ctx.translate(-centerX, -centerY);

      // Determine visible grid bounds based on actual screen size so grid fills the whole screen
      const viewWidthMeters = canvas.width / scale;
      const viewHeightMeters = canvas.height / scale;
      const visibleMinX = centerX - viewWidthMeters / 2;
      const visibleMaxX = centerX + viewWidthMeters / 2;
      const visibleMinY = centerY - viewHeightMeters / 2;
      const visibleMaxY = centerY + viewHeightMeters / 2;

      // Dynamic Grid Size to prevent millions of lines if zoomed out far!
      let gridSize = 10;
      while (viewWidthMeters / gridSize > 150 || viewHeightMeters / gridSize > 150) {
        gridSize *= 10;
      }

      // Grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = Math.max(1 / scale, 0.5); // At least visible physical thickness
      const startGridX = Math.floor(visibleMinX / gridSize) * gridSize;
      const startGridY = Math.floor(visibleMinY / gridSize) * gridSize;

      ctx.beginPath();
      for (let x = startGridX; x <= visibleMaxX; x += gridSize) {
        ctx.moveTo(x, visibleMinY);
        ctx.lineTo(x, visibleMaxY);
      }
      for (let y = startGridY; y <= visibleMaxY; y += gridSize) {
        ctx.moveTo(visibleMinX, y);
        ctx.lineTo(visibleMaxX, y);
      }
      ctx.stroke();

      // Mapped Area (Lightning-fast single-path fill!)
      // By wrapping each arc in moveTo/lineTo, they become closed subpaths.
      // ctx.fill() then perfectly unions them without overlapping opacity or jagged connecting lines!
      ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
      ctx.beginPath();
      pathASV.forEach((pt) => {
        const sweptConeAngle = Math.PI / 2 - (pt.heading * Math.PI) / 180;
        ctx.moveTo(pt.x, pt.y);
        ctx.arc(pt.x, pt.y, FOV_RADIUS_M, sweptConeAngle - FOV_HALF_ANGLE_RAD, sweptConeAngle + FOV_HALF_ANGLE_RAD);
        ctx.lineTo(pt.x, pt.y);
      });
      // Also draw the wedge at the current smooth position so it perfectly connects to the boat!
      const currentConeAngle = Math.PI / 2 - (smoothHeading * Math.PI) / 180;
      ctx.moveTo(smoothX, smoothY);
      ctx.arc(smoothX, smoothY, FOV_RADIUS_M, currentConeAngle - FOV_HALF_ANGLE_RAD, currentConeAngle + FOV_HALF_ANGLE_RAD);
      ctx.lineTo(smoothX, smoothY);
      ctx.fill();

      // Mapped Objects
      ctx.lineWidth = 1 / scale;
      ZedObjects.forEach((obs) => {
        const x = obs.position.x;
        const y = obs.position.y;
        const isHome = obs.label === "Home Dock";

        const colorKey = OBJECT_COLOR_KEYS[obs.label] ?? DEFAULT_OBJECT_COLOR_KEY;
        const objectColors = themeRef.current.palette.telemetry?.objects;
        const stroke = objectColors?.[colorKey as keyof typeof objectColors] ?? '#ef4444';
        const fill = alpha(stroke, 0.2);

        ctx.beginPath();
        if (isHome) {
          ctx.fillStyle = fill;
          ctx.strokeStyle = stroke;
          ctx.rect(x - 3, y - 3, 6, 6);
        } else {
          ctx.fillStyle = fill;
          ctx.strokeStyle = stroke;
          ctx.arc(x, y, 3, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.stroke();
      });

      // Vision Cone
      ctx.save();
      ctx.translate(currentX, currentY);

      // In this coordinate system, +X is Right, +Y is Up.
      // Standard maritime heading is 0=North(Up), 90=East(Right).
      // Angle 0 in Canvas is +X (Right). Math.PI/2 is +Y (Up).
      const coneAngle = Math.PI / 2 - (heading * Math.PI) / 180;

      ctx.fillStyle = 'rgba(16, 185, 129, 0.1)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, FOV_RADIUS_M, coneAngle - FOV_HALF_ANGLE_RAD, coneAngle + FOV_HALF_ANGLE_RAD);
      ctx.lineTo(0, 0);
      ctx.fill();
      ctx.restore();

      // Boat Icon (scales with the map, drawn at real hull size — see robot.ts —
      // with a minimum on-screen size so it doesn't vanish when zoomed out)
      if (boatImgRef.current) {
        ctx.save();
        ctx.translate(currentX, currentY);
        // We do NOT invert the scale, so it scales with the map properly!
        // We do need to invert Y for drawing the image properly (since canvas image draws top-left down)
        ctx.scale(1, -1);
        ctx.rotate((heading * Math.PI) / 180);
        const minBoatHWorld = MIN_BOAT_ICON_PX / scale;
        const boatH = Math.max(ROBOT_LENGTH_M, minBoatHWorld);
        const boatW = boatH * (ROBOT_WIDTH_M / ROBOT_LENGTH_M);
        ctx.drawImage(boatImgRef.current, -boatW / 2, -boatH / 2, boatW, boatH);
        ctx.restore();
      }

      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
    // Live state comes from the refs mirrored above — the render loop only needs to (re)start on mount.
  }, []);

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 0,
      backgroundColor: '#080721',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'monospace'
    }}>
      {/* 2D Canvas */}
      <div style={{ flex: 1, position: 'relative', cursor: 'default', overflow: 'hidden' }}>
        <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'block' }} />

        {/* Map Legend */}
        <div style={{
          position: 'absolute',
          top: '110px',
          left: '24px',
          backgroundColor: 'rgba(8, 7, 33, 0.85)',
          padding: '12px 16px',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          fontSize: '11px',
          color: '#F2F2F2',
          pointerEvents: 'none',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ width: '12px', height: '12px', border: '1px solid #B980F1', backgroundColor: 'rgba(185, 128, 241, 0.2)' }}></div>
            <span>ASV POSITION</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ width: '12px', height: '12px', backgroundColor: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.5)' }}></div>
            <span>MAPPED AREA</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ width: '12px', height: '12px', backgroundColor: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', borderRadius: '50%' }}></div>
            <span>NAV RED</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ width: '12px', height: '12px', backgroundColor: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', borderRadius: '50%' }}></div>
            <span>NAV GREEN</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ width: '12px', height: '12px', backgroundColor: 'rgba(234, 179, 8, 0.2)', border: '1px solid #eab308', borderRadius: '50%' }}></div>
            <span>OBSTACLE (YELLOW)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ width: '12px', height: '12px', backgroundColor: 'rgba(6, 182, 212, 0.2)', border: '1px solid #06b6d4', borderRadius: '50%' }}></div>
            <span>DOCK (BLUE)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '1px solid #f59e0b' }}></div>
            <span>BOUNDARY BUOY</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '12px', height: '12px', border: '1px solid #10b981', borderRadius: '2px' }}></div>
            <span>HOME DOCK</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BigMap;
