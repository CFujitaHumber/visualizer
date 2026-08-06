import React, { useEffect, useRef } from 'react';

export interface BigMapProps {
  pathHistory: React.MutableRefObject<any[]>;
  obstacles: React.MutableRefObject<any[]>;
  currentPos: React.MutableRefObject<{ x: number; y: number }>;
  headingRef: React.MutableRefObject<number>;
}

// SVG Catamaran Data URL for drawing on canvas
const catamaranSvgStr = `
<svg xmlns="http://www.w3.org/2000/svg" width="70" height="95" viewBox="0 0 80 110">
  <path d="M 16 5 C 10 5, 8 20, 8 45 C 8 70, 8 85, 12 90 C 14 93, 18 93, 20 90 C 22 85, 22 75, 22 65 L 22 25 C 22 15, 20 5, 16 5 Z" fill="#00435C" stroke="#B980F1" strokeWidth="1" />
  <path d="M 64 5 C 70 5, 72 20, 72 45 C 72 70, 72 85, 68 90 C 66 93, 62 93, 60 90 C 58 85, 58 75, 58 65 L 58 25 C 58 15, 60 5, 64 5 Z" fill="#00435C" stroke="#B980F1" strokeWidth="1" />
  <rect x="21" y="20" width="38" height="4" fill="#080721" stroke="#D9D9D9" strokeWidth="1" />
  <rect x="21" y="70" width="38" height="4" fill="#080721" stroke="#D9D9D9" strokeWidth="1" />
  <path d="M 26 24 C 23 35, 23 60, 26 70" fill="none" stroke="#D9D9D9" strokeWidth="1.5" />
  <path d="M 54 24 C 57 35, 57 60, 54 70" fill="none" stroke="#D9D9D9" strokeWidth="1.5" />
  <path d="M 28 32 C 26 45, 26 50, 28 62 L 52 62 C 54 50, 54 45, 52 32 Z" fill="#080721" stroke="#D9D9D9" strokeWidth="1.5" />
  <rect x="33" y="38" width="14" height="18" rx="2" fill="none" stroke="#B980F1" strokeWidth="1" />
  <circle cx="35" cy="40" r="1" fill="#D8FA07" />
  <circle cx="45" cy="40" r="1" fill="#D8FA07" />
  <circle cx="35" cy="54" r="1" fill="#D8FA07" />
  <circle cx="45" cy="54" r="1" fill="#D8FA07" />
</svg>
`;

export const BigMap: React.FC<BigMapProps> = ({ pathHistory, obstacles, currentPos, headingRef }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boatImgRef = useRef<HTMLImageElement | null>(null);
  const mapBoundsRef = useRef({ minX: -25, maxX: 25, minY: -25, maxY: 25 });

  useEffect(() => {
    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(catamaranSvgStr);
    img.onload = () => { boatImgRef.current = img; };
  }, []);

  // Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    let smoothX = currentPos.current.x;
    let smoothY = currentPos.current.y;
    let smoothHeading = headingRef.current;
    
    let smoothScale = 0;
    let cameraCX = 0;
    let cameraCY = 0;
    let isCameraInit = false;

    const render = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect && (canvas.width !== rect.width || canvas.height !== rect.height)) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }

      if (canvas.width === 0 || canvas.height === 0) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      const targetX = currentPos.current.x;
      const targetY = currentPos.current.y;
      const targetH = headingRef.current;
      
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
      obstacles.current.forEach(obs => {
        const x = obs.position?.x ?? obs.x ?? 0;
        const y = obs.position?.y ?? obs.y ?? 0;
        maxViewDistX = Math.max(maxViewDistX, Math.abs(x - cameraCX) + 40);
        maxViewDistY = Math.max(maxViewDistY, Math.abs(y - cameraCY) + 40);
      });
      
      // Ensure the entire mapped blue trail remains on screen
      pathHistory.current.forEach(pt => {
        maxViewDistX = Math.max(maxViewDistX, Math.abs(pt.x - cameraCX) + 40);
        maxViewDistY = Math.max(maxViewDistY, Math.abs(pt.y - cameraCY) + 40);
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
      pathHistory.current.forEach((pt) => {
        const sweptConeAngle = Math.PI / 2 - (pt.h * Math.PI) / 180;
        ctx.moveTo(pt.x, pt.y);
        ctx.arc(pt.x, pt.y, 40, sweptConeAngle - Math.PI / 6, sweptConeAngle + Math.PI / 6);
        ctx.lineTo(pt.x, pt.y);
      });
      // Also draw the wedge at the current smooth position so it perfectly connects to the boat!
      const currentConeAngle = Math.PI / 2 - (smoothHeading * Math.PI) / 180;
      ctx.moveTo(smoothX, smoothY);
      ctx.arc(smoothX, smoothY, 40, currentConeAngle - Math.PI / 6, currentConeAngle + Math.PI / 6);
      ctx.lineTo(smoothX, smoothY);
      ctx.fill();

      // Mapped Objects
      ctx.lineWidth = 1 / scale;
      obstacles.current.forEach((obs: any) => {
        const x = obs.position?.x ?? obs.x ?? 0;
        const y = obs.position?.y ?? obs.y ?? 0;
        const isHome = obs.label === "Home Dock";
        
        let fill = 'rgba(239, 68, 68, 0.2)';
        let stroke = '#ef4444';
        
        if (obs.label === "Boundary Buoy") {
           fill = 'rgba(245, 158, 11, 0.2)'; stroke = '#f59e0b';
        } else if (obs.label === "Nav Green") {
           fill = 'rgba(16, 185, 129, 0.2)'; stroke = '#10b981';
        } else if (obs.label === "Nav Red") {
           fill = 'rgba(239, 68, 68, 0.2)'; stroke = '#ef4444';
        } else if (obs.label === "Obstacle" || obs.label === "Speed Gate" || obs.label === "Turnaround Buoy") {
           fill = 'rgba(234, 179, 8, 0.2)'; stroke = '#eab308';
        } else if (obs.label === "Dock Buoy") {
           fill = 'rgba(6, 182, 212, 0.2)'; stroke = '#06b6d4';
        } else if (obs.label === "Acoustic Beacon") {
           fill = 'rgba(168, 85, 247, 0.2)'; stroke = '#a855f7';
        } else if (obs.label === "Island") {
           fill = 'rgba(209, 213, 219, 0.2)'; stroke = '#d1d5db';
        }
        
        ctx.beginPath();
        if (isHome) {
          ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
          ctx.strokeStyle = '#10b981';
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
      ctx.arc(0, 0, 40, coneAngle - Math.PI / 6, coneAngle + Math.PI / 6);
      ctx.lineTo(0, 0);
      ctx.fill();
      ctx.restore();
      
      // Boat Icon (Scale with the map, drawn intentionally large to be visible: 8m x 11.2m physical size)
      if (boatImgRef.current) {
        ctx.save();
        ctx.translate(currentX, currentY);
        // We do NOT invert the scale, so it scales with the map properly!
        // We do need to invert Y for drawing the image properly (since canvas image draws top-left down)
        ctx.scale(1, -1);
        ctx.rotate((heading * Math.PI) / 180);
        const boatW = 8;
        const boatH = 11.2;
        ctx.drawImage(boatImgRef.current, -boatW/2, -boatH/2, boatW, boatH);
        ctx.restore();
      }

      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
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
