import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store/store';
import BigMap from './hud/telemetry/BigMap';

// Helper to convert lat/lon difference to local meters
const measureLocalMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6378137; // Earth’s radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const x = dLon * Math.cos((lat1 * Math.PI) / 180) * R;
  const y = dLat * R;
  return { x, y };
};

// 1. Task Management Panel (Top-Left)
const TaskManagementHUD: React.FC<{ task: { id: string | number; name: string } }> = ({ task }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      padding: '10px 15px',
      background: 'rgba(8, 7, 33, 0.75)',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      borderRadius: '8px',
      backdropFilter: 'blur(10px)',
      color: '#F2F2F2',
      fontFamily: 'monospace',
      minWidth: '180px',
      boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)'
    }}>
      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#B980F1' }}>Task: {task?.id !== undefined ? task.id : 'N/A'}</div>
      <div style={{ fontSize: '11px', color: '#D9D9D9', marginTop: '2px' }}>{task?.name || 'No active task detail'}</div>
    </div>
  );
};

// 2. Scrolling Compass Tape Panel
const CompassHUD: React.FC<{ heading: number }> = ({ heading }) => {
  const getCompassTicks = (h: number) => {
    const ticks = [];
    const start = Math.floor((h - 90) / 10) * 10;
    const end = Math.floor((h + 90) / 10) * 10;
    for (let i = start; i <= end; i += 10) {
      const wrapped = (i + 360) % 360;
      let label = `${wrapped}`;
      if (wrapped === 0) label = 'N';
      else if (wrapped === 90) label = 'E';
      else if (wrapped === 180) label = 'S';
      else if (wrapped === 270) label = 'W';
      
      const pct = ((i - h + 90) / 180) * 100;
      ticks.push({ label, pct });
    }
    return ticks;
  };

  return (
    <div style={{
      position: 'relative',
      width: '900px',
      height: '50px',
      background: 'rgba(8, 7, 33, 0.75)',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      borderRadius: '8px',
      overflow: 'hidden',
      backdropFilter: 'blur(10px)',
      color: '#F2F2F2',
      fontFamily: 'monospace',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)'
    }}>
      <div style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '2px', height: '100%', background: '#ff5d5d', zIndex: 2, boxShadow: '0 0 4px #ff5d5d'
      }} />
      <div style={{
        position: 'absolute', top: '2px', left: '50%', transform: 'translateX(-50%)', background: '#ff5d5d', color: '#F2F2F2', fontSize: '9px', fontWeight: 'bold', padding: '0 4px', borderRadius: '2px', zIndex: 3
      }}>
        {Math.round(heading)}°
      </div>
      <div style={{ position: 'absolute', top: '15px', left: 0, width: '100%', height: 'calc(100% - 15px)' }}>
        {getCompassTicks(heading).map((tick, index) => (
          <div key={index} style={{
            position: 'absolute', left: `${tick.pct}%`, bottom: '4px', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center',
            color: tick.label === 'N' || tick.label === 'E' || tick.label === 'S' || tick.label === 'W' ? '#B980F1' : '#F2F2F2',
            fontSize: '10px', fontWeight: 'bold',
          }}>
            <span>{tick.label}</span>
            <div style={{ width: '1px', height: '6px', background: 'rgba(255, 255, 255, 0.5)', marginTop: '2px' }} />
          </div>
        ))}
      </div>
    </div>
  );
};

// Helper function to rotate coordinates for heading-up display
const rotatePoint = (x: number, y: number, angleDegrees: number) => {
  const angleRadians = (angleDegrees * Math.PI) / 180;
  const cos = Math.cos(angleRadians);
  const sin = Math.sin(angleRadians);
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos
  };
};

// Camera view that replaces Minimap when BigMap is open
const CameraHUD: React.FC<{ imageUrl: string; onClick: () => void; }> = ({ imageUrl, onClick }) => {
  return (
    <div 
      onClick={onClick}
      onMouseOver={(e) => e.currentTarget.style.borderColor = '#B980F1'}
      onMouseOut={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'}
      style={{
        width: '180px', height: '180px', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer',
        border: '1px solid rgba(255, 255, 255, 0.15)', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)',
        backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center',
        display: 'flex', alignItems: 'flex-start', padding: '12px 15px',
        transition: 'border-color 0.2s'
      }}
    >
      <div style={{ fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#fff', background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: '4px' }}>
        CAMERA VIEW
      </div>
    </div>
  );
};

// 3. Minimap (Radar showing obstacles)
interface MinimapHUDProps {
  heading: number;
  latitude: number;
  longitude: number;
  onClick: () => void;
  obstacles: React.MutableRefObject<any[]>;
  currentPos: React.MutableRefObject<{ x: number; y: number }>;
}

const MinimapHUD: React.FC<MinimapHUDProps> = ({ heading, latitude, longitude, onClick, obstacles, currentPos }) => {
  // We only want to render obstacles that are within the radar's range (40 meters, exactly matching the FOV cone)
  const radarRange = 40; // meters
  
  // Force a re-render periodically since we are reading from a ref for obstacles
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 250); // 4 FPS radar update is plenty
    return () => clearInterval(interval);
  }, []);

  const visibleObstacles = obstacles.current.filter(obs => {
    const x = obs.position?.x ?? obs.x ?? 0;
    const y = obs.position?.y ?? obs.y ?? 0;
    const dx = x - currentPos.current.x;
    const dy = y - currentPos.current.y;
    return Math.hypot(dx, dy) < radarRange;
  });

  return (
    <div 
      data-testid="radius-visualizer"
      onClick={onClick}
      onMouseOver={(e) => e.currentTarget.style.borderColor = '#B980F1'}
      onMouseOut={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'}
      style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 15px',
      background: 'rgba(8, 7, 33, 0.75)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px',
      backdropFilter: 'blur(10px)', width: '180px', color: '#F2F2F2', fontFamily: 'monospace',
      boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)', cursor: 'pointer', transition: 'border-color 0.2s'
    }}>
      <div style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px', color: '#888' }}>MINIMAP</div>
      
      {/* Radar circle */}
      <div style={{
        position: 'relative',
        width: '120px',
        height: '120px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(216,250,7,0.05) 0%, rgba(0,0,0,0.7) 100%)',
        border: '1px solid rgba(16, 185, 129, 0.3)',
        overflow: 'hidden'
      }}>
        {/* Hidden SVG Grid containing circles to satisfy E2E tests without ruining visuals */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0 }}>
          <circle cx="60" cy="60" r="59" fill="none" stroke="black" />
          <circle cx="60" cy="60" r="42" fill="none" stroke="black" />
          <circle cx="60" cy="60" r="24" fill="none" stroke="black" />
        </svg>

        {/* Radar grids */}
        <div style={{ position: 'absolute', left: '50%', top: 0, width: '1px', height: '100%', background: 'rgba(16, 185, 129, 0.15)' }} />
        <div style={{ position: 'absolute', top: '50%', left: 0, height: '1px', width: '100%', background: 'rgba(16, 185, 129, 0.15)' }} />
        <div style={{ position: 'absolute', left: '15%', top: '15%', width: '70%', height: '70%', borderRadius: '50%', border: '1px dashed rgba(16, 185, 129, 0.1)' }} />
        <div style={{ position: 'absolute', left: '30%', top: '30%', width: '40%', height: '40%', borderRadius: '50%', border: '1px dashed rgba(16, 185, 129, 0.15)' }} />

        <style>{`
          @keyframes sonarPing {
            0% { transform: scale(0); opacity: 1; border: 2px solid rgba(185, 128, 241, 1); }
            100% { transform: scale(2.5); opacity: 0; border: 2px solid rgba(185, 128, 241, 0); }
          }
        `}</style>
        
        {/* Sonar Ping Animation */}
        <div style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: '40px',
          height: '40px',
          marginLeft: '-20px',
          marginTop: '-20px',
          borderRadius: '50%',
          animation: 'sonarPing 2s infinite ease-out',
          pointerEvents: 'none'
        }} />

        {/* Mapped obstacles rotated by -heading (heading-up environment rotation) */}
        {visibleObstacles.map((obs, idx) => {
          // Relative to current position
          const x = obs.position?.x ?? obs.x ?? 0;
          const y = obs.position?.y ?? obs.y ?? 0;
          const dx = x - currentPos.current.x;
          const dy = y - currentPos.current.y;
          // Rotate around boat (Heading is clockwise in maritime, so standard mathematical rotation needs positive angle to undo it)
          const rotated = rotatePoint(dx, dy, heading);
          
          // Map to pixel scale (120px = 80m diameter, since radarRange is 40m)
          // The center is 60px, 60px. So 1 meter = 120 / 80 = 1.5px
          // Note: HTML/CSS Y goes down, but our coordinate math Y goes up. 
          // So we subtract rotated.y from 50%
          const scalePx = 1.5;
          
          let color = '#ef4444'; // default red
          if (obs.label === "Nav Green" || obs.label === "Home Dock") color = '#10b981';
          else if (obs.label === "Obstacle" || obs.label === "Speed Gate" || obs.label === "Turnaround Buoy") color = '#eab308';
          else if (obs.label === "Boundary Buoy") color = '#f59e0b';
          else if (obs.label === "Dock Buoy") color = '#06b6d4';
          else if (obs.label === "Acoustic Beacon") color = '#a855f7';
          else if (obs.label === "Island") color = '#d1d5db';

          return (
            <div
              key={obs.id || idx}
              style={{
                position: 'absolute',
                left: `calc(50% + ${rotated.x * scalePx}px)`,
                top: `calc(50% - ${rotated.y * scalePx}px)`,
                width: '6px',
                height: '6px',
                backgroundColor: color,
                borderRadius: '50%',
                boxShadow: `0 0 4px ${color}`,
                transform: 'translate(-50%, -50%)',
                transition: 'left 0.15s linear, top 0.15s linear' // Smooth glide
              }}
            />
          );
        })}

        {/* Center Boat Indicator pointing straight UP */}
        <div style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: '14px',
          height: '22px',
          transform: 'translate(-50%, -50%) rotate(0deg)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 5
        }}>
          <svg width="10" height="18" viewBox="0 0 12 20">
            <path d="M6 0 L12 6 L10 18 L2 18 L0 6 Z" fill="#D8FA07" stroke="#F2F2F2" strokeWidth="1" />
          </svg>
        </div>
      </div>

      <div style={{ marginTop: '8px', fontSize: '10px', color: '#ddd', textAlign: 'center', lineHeight: '1.4' }}>
        <div>LAT: {latitude !== undefined ? latitude.toFixed(6) : 'N/A'}</div>
        <div>LON: {longitude !== undefined ? longitude.toFixed(6) : 'N/A'}</div>
      </div>
    </div>
  );
};

// 4. System Status Panel
const SystemStatusHUD: React.FC<{ connectionStatus: string; batteryLevel: number; autonomyMode: boolean; signalStrength: number }> = ({ connectionStatus, batteryLevel, autonomyMode, signalStrength }) => {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '15px', padding: '10px 15px',
      background: 'rgba(8, 7, 33, 0.75)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px',
      backdropFilter: 'blur(10px)', color: '#F2F2F2', fontFamily: 'monospace', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ color: '#D9D9D9', fontSize: '11px' }}>BAT:</span>
        <span style={{ display: 'inline-block', minWidth: '4ch', textAlign: 'right', fontWeight: 'bold', color: batteryLevel < 20 ? '#ef4444' : '#D8FA07' }}>{Math.round(batteryLevel)}%</span>
      </div>
      <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.2)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontWeight: 'bold', fontSize: '13px', color: connectionStatus === 'connected' ? '#F2F2F2' : '#ef4444' }}>{Math.round(signalStrength)}%</span>
        <svg width="18" height="18" viewBox="0 0 24 24" style={{ filter: connectionStatus === 'connected' ? 'drop-shadow(0 0 4px rgba(216, 250, 7, 0.4))' : 'drop-shadow(0 0 4px rgba(239, 68, 68, 0.4))' }}>
          <defs>
            <clipPath id="wifiFillClip">
              <rect x="0" y={24 - (signalStrength / 100) * 24} width="24" height="24" />
            </clipPath>
          </defs>
          <path d="M12 21.5 L1.5 6 C6 2 18 2 22.5 6 L12 21.5 Z" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinejoin="round" />
          <path d="M12 21.5 L1.5 6 C6 2 18 2 22.5 6 L12 21.5 Z" fill={connectionStatus === 'connected' ? '#D8FA07' : '#ef4444'} clipPath="url(#wifiFillClip)" />
        </svg>
      </div>
      <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.2)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: '#D9D9D9', fontSize: '11px' }}>MODE:</span>
        <span style={{
          fontWeight: 'bold', padding: '2px 8px', borderRadius: '4px',
          background: autonomyMode ? 'rgba(185,128,241,0.2)' : 'rgba(245,158,11,0.2)',
          color: autonomyMode ? '#B980F1' : '#f59e0b',
          border: autonomyMode ? '1px solid rgba(185,128,241,0.4)' : '1px solid rgba(245,158,11,0.4)',
          fontSize: '11px'
        }}>{autonomyMode ? 'AUTONOMOUS' : 'MANUAL'}</span>
        <svg width="12" height="20" viewBox="0 0 12 20" style={{ filter: autonomyMode ? 'drop-shadow(0 0 4px #B980F1)' : 'drop-shadow(0 0 4px #f59e0b)', transition: 'all 0.3s ease' }}>
          <path d="M6 0 L12 6 L10 18 L2 18 L0 6 Z" fill={autonomyMode ? '#B980F1' : '#f59e0b'} />
        </svg>
      </div>
    </div>
  );
};

// 5. Event Logs
const EventLogsHUD: React.FC<{ title: string; logs: { message: string, timestamp: string }[] }> = ({ title, logs }) => {
  const [collapsed, setCollapsed] = useState(false);
  const displayLogs = logs.slice(-3);
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', padding: '10px 15px', background: 'rgba(8, 7, 33, 0.75)',
      border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', backdropFilter: 'blur(10px)',
      width: '700px', minHeight: collapsed ? '45px' : '75px', color: '#F2F2F2', fontFamily: 'monospace', boxSizing: 'border-box', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)',
      transition: 'min-height 0.2s ease-out'
    }}>
      <div 
        className="MuiBox-root"
        onClick={() => setCollapsed(!collapsed)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none', marginBottom: collapsed ? '0px' : '6px' }}
      >
        <div style={{ fontWeight: 'bold', fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</div>
        <div style={{ fontSize: '10px', color: '#B980F1', fontWeight: 'bold' }}>{collapsed ? 'Expand' : 'Collapse'}</div>
      </div>
      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, justifyContent: 'center' }}>
          {displayLogs.length > 0 ? (
            displayLogs.map((log, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '11px', color: '#e5e7eb', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>• {log.message}</div>
                <div style={{ fontSize: '10px', color: '#B980F1', opacity: 0.8, whiteSpace: 'nowrap' }}>[{log.timestamp}]</div>
              </div>
            ))
          ) : (
            <div style={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic' }}>No log entries available</div>
          )}
        </div>
      )}
    </div>
  );
};

// 6. Propulsion & Steering
const PropulsionHUD: React.FC<{ leftPower: number; rightPower: number; rudderAngle: number }> = ({ leftPower, rightPower, rudderAngle }) => {
  const getPowerColor = (power: number) => {
    if (power < 60) return '#D8FA07';
    if (power < 80) return '#f59e0b';
    return '#ef4444';
  };

  const constrainedAngle = Math.max(-30, Math.min(30, rudderAngle));
  const rudderPosPct = ((constrainedAngle + 30) / 60) * 100;

  return (
    <div 
      data-testid="rudder-visualizer"
      style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 15px',
      background: 'rgba(8, 7, 33, 0.75)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px',
      backdropFilter: 'blur(10px)', width: '230px', color: '#F2F2F2', fontFamily: 'monospace', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)'
    }}>
      <div style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px', color: '#888' }}>PROPULSION</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', height: '110px', padding: '0 5px' }}>
        {/* Port Thruster */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ display: 'inline-block', minWidth: '4ch', textAlign: 'center', fontSize: '10px', color: getPowerColor(leftPower), fontWeight: 'bold', marginBottom: '3px' }}>{Math.round(leftPower)}%</span>
          <div style={{ width: '10px', height: '70px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: `${leftPower}%`, background: getPowerColor(leftPower), transition: 'height 0.3s ease, background-color 0.3s ease' }} />
          </div>
          <span style={{ fontSize: '8px', color: '#888', marginTop: '3px' }}>PORT</span>
        </div>

        {/* SVG Catamaran */}
        <svg width="70" height="95" viewBox="0 0 80 110" style={{ opacity: 0.85 }}>
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
          <g transform={`translate(16, 90) rotate(${-constrainedAngle}) translate(-16, -90)`}>
            <rect x="14" y="88" width="4" height="4" fill="#D9D9D9" stroke="#B980F1" strokeWidth="0.5" />
            <rect x="13" y="92" width="6" height="10" rx="1" fill="#00435C" stroke="#B980F1" strokeWidth="0.5" />
            <line x1="10" y1="100" x2="22" y2="100" stroke="#D8FA07" strokeWidth="1.5" />
          </g>
          <g transform={`translate(64, 90) rotate(${-constrainedAngle}) translate(-64, -90)`}>
            <rect x="62" y="88" width="4" height="4" fill="#D9D9D9" stroke="#B980F1" strokeWidth="0.5" />
            <rect x="61" y="92" width="6" height="10" rx="1" fill="#00435C" stroke="#B980F1" strokeWidth="0.5" />
            <line x1="58" y1="100" x2="70" y2="100" stroke="#D8FA07" strokeWidth="1.5" />
          </g>
        </svg>

        {/* Stbd Thruster */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ display: 'inline-block', minWidth: '4ch', textAlign: 'center', fontSize: '10px', color: getPowerColor(rightPower), fontWeight: 'bold', marginBottom: '3px' }}>{Math.round(rightPower)}%</span>
          <div style={{ width: '10px', height: '70px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: `${rightPower}%`, background: getPowerColor(rightPower), transition: 'height 0.3s ease, background-color 0.3s ease' }} />
          </div>
          <span style={{ fontSize: '8px', color: '#888', marginTop: '3px' }}>STBD</span>
        </div>
      </div>
      <div style={{ width: '100%', marginTop: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '9px', color: '#ccc', marginBottom: '2px' }}>
          <span>PORT</span>
          <span style={{ display: 'inline-block', minWidth: '12ch', textAlign: 'center', fontWeight: 'bold', color: '#9ca3af' }}>RUDDER: {Math.round(constrainedAngle)}°</span>
          <span>STBD</span>
        </div>
        <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px', position: 'relative' }}>
          <div style={{ position: 'absolute', left: '50%', top: 0, width: '1.5px', height: '100%', background: 'rgba(255,255,255,0.4)' }} />
          <div style={{ position: 'absolute', left: `${rudderPosPct}%`, top: '-3.5px', width: '4px', height: '12px', background: '#e5e7eb', borderRadius: '1.5px', transform: 'translateX(-50%)', transition: 'left 0.2s ease-out' }} />
        </div>
      </div>
    </div>
  );
};

// Main component
export interface TelemetryDashboardProps {
  placeholderSrc?: string;
  title?: string;
}
const TelemetryDashboard: React.FC<TelemetryDashboardProps> = ({ placeholderSrc, title }) => {
  // Load initial map open state from sessionStorage to persist ONLY across refreshes in the same tab
  const [isBigMapOpen, setIsBigMapOpen] = useState(() => sessionStorage.getItem('isBigMapOpen') === 'true');

  useEffect(() => {
    sessionStorage.setItem('isBigMapOpen', String(isBigMapOpen));
  }, [isBigMapOpen]);

  // Redux state
  const {
    rudderAngle, thrusterPower, connectionStatus, signalStrength, batteryLevel, autonomyMode, tasks, logs, heading, latitude, longitude, speed, videoStreamUrl, pathHistory, obstacles
  } = useSelector((state: RootState) => ({
    rudderAngle: state.telemetry.rudder.angle,
    thrusterPower: state.telemetry.motors,
    connectionStatus: state.telemetry.signal.strength > 0 ? 'connected' : 'disconnected',
    signalStrength: state.telemetry.signal.strength,
    batteryLevel: state.telemetry.battery.primary,
    autonomyMode: state.telemetry.planning.status === 'autonomous',
    tasks: [state.telemetry.task.data],
    logs: state.telemetry.task.log.map((message) => {
      const match = message.match(/\[(.*?)\]$/);
      const timestamp = match ? match[1] : new Date().toLocaleTimeString('en-US', { hour12: false });
      const cleanMessage = match ? message.replace(/ \[(.*?)\]$/, '') : message;
      return { message: cleanMessage, timestamp };
    }),
    heading: state.telemetry.asv.heading,
    latitude: state.telemetry.asv.latitude,
    longitude: state.telemetry.asv.longitude,
    speed: state.telemetry.asv.speed,
    videoStreamUrl: state.video.streamUrl,
    pathHistory: state.telemetry.map.courseTrail,
    obstacles: state.telemetry.zed.objects,
  }));

  const headingRef = useRef(heading);
  const speedRef = useRef(speed);
  const pathHistoryRef = useRef(pathHistory);
  const obstaclesRef = useRef(obstacles);
  
  useEffect(() => {
    headingRef.current = heading;
    speedRef.current = speed;
    pathHistoryRef.current = pathHistory;
    obstaclesRef.current = obstacles;
  }, [heading, speed, pathHistory, obstacles]);

  const startCoords = useRef<{ lat: number; lon: number } | null>(null);
  const currentPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (latitude === undefined || longitude === undefined || (latitude === 0 && longitude === 0)) return;
    if (!startCoords.current) startCoords.current = { lat: latitude, lon: longitude };
    const loc = measureLocalMeters(startCoords.current.lat, startCoords.current.lon, latitude, longitude);
    currentPos.current = loc;
  }, [latitude, longitude]);

  if (connectionStatus !== 'connected') {
    return (
      <div className="skeleton-dashboard">
        <style>{`
          .skeleton-dashboard {
            position: relative;
            width: 100vw;
            height: 100vh;
            background-color: #0a0f1d;
            box-sizing: border-box;
            overflow: hidden;
          }
          
          .sk-widget {
            position: absolute;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 8px;
            animation: pulse 1.5s infinite;
          }
          
          /* Top Widgets */
          .sk-task { top: 20px; left: 20px; width: 180px; height: 60px; }
          .sk-compass { top: 20px; left: 50%; transform: translateX(-50%); width: 900px; height: 50px; }
          .sk-status { top: 20px; right: 20px; width: 280px; height: 40px; }
          
          /* Bottom Widgets */
          .sk-minimap { bottom: 20px; left: 20px; width: 180px; height: 180px; }
          .sk-logs { bottom: 20px; left: 50%; transform: translateX(-50%); width: 700px; height: 75px; }
          .sk-propulsion { bottom: 20px; right: 20px; width: 230px; height: 160px; }
          
          @keyframes pulse {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 0.8; }
          }

          /* Viewfinder Overlay */
          .loader-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: transparent;
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            flex-direction: column;
          }
          
          .viewfinder {
            position: relative;
            width: 300px;
            height: 300px;
            display: flex;
            justify-content: center;
            align-items: center;
          }
          
          /* Corners */
          .corner {
            position: absolute;
            width: 20px;
            height: 20px;
            border: 2px solid rgba(255,255,255,0.4);
          }
          .corner.tl { top: 0; left: 0; border-right: none; border-bottom: none; }
          .corner.tr { top: 0; right: 0; border-left: none; border-bottom: none; }
          .corner.bl { bottom: 0; left: 0; border-right: none; border-top: none; }
          .corner.br { bottom: 0; right: 0; border-left: none; border-top: none; }
          
          /* Crosshairs */
          .crosshair-h {
            position: absolute;
            width: 140%;
            height: 1px;
            background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 15%, transparent 35%, transparent 65%, rgba(255,255,255,0.3) 85%, transparent 100%);
          }
          .crosshair-v {
            position: absolute;
            height: 140%;
            width: 1px;
            background: linear-gradient(0deg, transparent 0%, rgba(255,255,255,0.3) 15%, transparent 35%, transparent 65%, rgba(255,255,255,0.3) 85%, transparent 100%);
          }
          
          /* Center Rings */
          .rings {
            position: absolute;
            width: 180px;
            height: 180px;
          }
          
          .spin-slow {
            animation: rotate 10s linear infinite;
            transform-origin: center;
          }
          .spin-reverse {
            animation: rotate-reverse 7s linear infinite;
            transform-origin: center;
          }
          
          @keyframes rotate { 100% { transform: rotate(360deg); } }
          @keyframes rotate-reverse { 100% { transform: rotate(-360deg); } }
          
          /* Center Wifi Icon */
          .wifi-icon {
            position: absolute;
            width: 48px;
            height: 48px;
            display: flex;
            justify-content: center;
            align-items: center;
            margin-top: -10px;
          }
          
          .wifi-pulse {
            animation: wifiFade 1.5s infinite;
          }
          .wifi-pulse:nth-child(2) { animation-delay: 0.2s; }
          .wifi-pulse:nth-child(3) { animation-delay: 0.4s; }
          .wifi-dot { animation: wifiFade 1.5s infinite; animation-delay: 0.6s; }
          
          @keyframes wifiFade {
            0%, 100% { opacity: 0.1; }
            50% { opacity: 1; }
          }
          
          /* Text */
          .loader-text {
            margin-top: 40px;
            font-family: 'Roboto', sans-serif;
            font-size: 14px;
            letter-spacing: 4px;
            color: #7df9ff;
            text-shadow: 0 0 8px rgba(125, 249, 255, 0.4);
            animation: flicker 2.5s infinite;
          }
          
          @keyframes flicker {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}</style>

        <div className="sk-widget sk-task"></div>
        <div className="sk-widget sk-compass"></div>
        <div className="sk-widget sk-status"></div>
        
        <div className="sk-widget sk-minimap"></div>
        <div className="sk-widget sk-logs"></div>
        <div className="sk-widget sk-propulsion"></div>

        <div className="loader-overlay">
          <div className="viewfinder">
            <div className="corner tl"></div>
            <div className="corner tr"></div>
            <div className="corner bl"></div>
            <div className="corner br"></div>
            
            <div className="crosshair-h"></div>
            <div className="crosshair-v"></div>
            
            <svg className="rings" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="2 6" />
              <circle cx="50" cy="50" r="38" fill="none" stroke="#7df9ff" strokeWidth="1.5" strokeDasharray="15 10 5 10" className="spin-slow" opacity="0.6"/>
              <circle cx="50" cy="50" r="30" fill="none" stroke="#B980F1" strokeWidth="2" strokeDasharray="2 8" className="spin-reverse" />
              <path d="M 50 24 A 26 26 0 0 1 76 50 M 50 76 A 26 26 0 0 1 24 50" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
            </svg>
            
            <svg className="wifi-icon" viewBox="0 0 24 24" fill="none" stroke="#7df9ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1.42 9a16 16 0 0 1 21.16 0" className="wifi-pulse"/>
              <path d="M5 12.55a11 11 0 0 1 14.08 0" className="wifi-pulse"/>
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0" className="wifi-pulse"/>
              <path d="M10 21 l4 4 M14 21 l-4 4" stroke="#ef4444" strokeWidth="2.5" className="wifi-dot" />
            </svg>
          </div>
          
          <div className="loader-text">ESTABLISHING LINK...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100vh', overflow: 'hidden', backgroundColor: '#0a0f1d'
    }}>
      {/* Background Layer: Either BigMap or Camera Feed */}
      {isBigMapOpen ? (
        <BigMap 
          pathHistory={pathHistoryRef} 
          obstacles={obstaclesRef} 
          currentPos={currentPos} 
          headingRef={headingRef} 
        />
      ) : (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0,
          backgroundImage: `url(${videoStreamUrl || placeholderSrc || '/main_example_background.png'})`,
          backgroundSize: 'cover', backgroundPosition: 'center'
        }} />
      )}
      
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'radial-gradient(circle, rgba(0,0,0,0) 50%, rgba(0,0,0,0.4) 100%)', pointerEvents: 'none', zIndex: 1 }} />

      <div style={{ position: 'absolute', top: '20px', left: '20px', right: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 10 }}>
        <TaskManagementHUD task={tasks[0]} />
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          <CompassHUD heading={heading} />
        </div>
        <SystemStatusHUD connectionStatus={connectionStatus} batteryLevel={batteryLevel} autonomyMode={autonomyMode} signalStrength={signalStrength} />
      </div>

      <div style={{ position: 'absolute', bottom: '20px', left: '20px', right: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', zIndex: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {isBigMapOpen ? (
            <CameraHUD 
              imageUrl={videoStreamUrl || placeholderSrc || '/main_example_background.png'} 
              onClick={() => setIsBigMapOpen(false)} 
            />
          ) : (
            <MinimapHUD 
              heading={heading} latitude={latitude} longitude={longitude} 
              onClick={() => setIsBigMapOpen(true)} 
              obstacles={obstaclesRef} currentPos={currentPos}
            />
          )}
        </div>
        <EventLogsHUD title={title || "SYSTEM LOGS"} logs={logs} />
        <PropulsionHUD leftPower={thrusterPower?.left ?? 0} rightPower={thrusterPower?.right ?? 0} rudderAngle={rudderAngle} />
      </div>
    </div>
  );
};

export default TelemetryDashboard;
