/**
 * @file TelemetryDashboard.tsx
 *
 * @description
 * This component serves as the main telemetry dashboard for the ASV.
 * It aggregates various telemetry components such as the task panel, compass,
 * radar (obstacle radius), propulsion, battery/signal status, and a live log
 * of telemetry events, overlaid on either a live video stream or a full-screen
 * course map.
 *
 * @author Carson Fujita
 * @license MIT
 *
 * @remarks
 * - The component uses React and Material-UI for the user interface, and Redux for state management.
 * - The background layer swaps between the ASV's live video stream (or `placeholderSrc`) and a
 *   full-screen course map ({@link BigMap}), toggled by clicking the radar/camera panel.
 * - Each overlay panel (task, compass, status, radar, logs, propulsion) connects to Redux directly,
 *   so this component itself only reads the state needed to decide which background/skeleton to render.
 * - When there is no stream and no `placeholderSrc` prop, a themed empty background is shown instead.
 * - A skeleton loading state with a viewfinder animation is shown while disconnected.
 * @example
 * ```tsx
 * <TelemetryDashboard placeholderSrc={fallbackJpg} title="Live Log" />
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

import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store/store';
import BigMap from './hud/telemetry/BigMap';
import TaskManagementHUD from './hud/telemetry/TaskManagementHUD';
import SystemStatusHUD from './hud/telemetry/SystemStatusHUD';
import EventLogsHUD from './hud/telemetry/EventLogsHUD';
import { RadiusVisualizerPanel, ShipRudderVisualizerPanel } from './hud/telemetry';
import { measureLocalMeters } from '../utils/geo';

// Scrolling Compass Tape Panel
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
      maxWidth: '100%',
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

// Camera view that replaces the radar panel when BigMap is open
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

// Main component
export interface TelemetryDashboardProps {
  /** Image shown behind the dashboard when no video stream is available. */
  placeholderSrc?: string;
  /** Label of the collapsible log drawer header. */
  title?: string;
}
const TelemetryDashboard: React.FC<TelemetryDashboardProps> = ({ placeholderSrc, title = 'Live Log Laugh' }) => {
  // Load initial map open state from sessionStorage to persist ONLY across refreshes in the same tab
  const [isBigMapOpen, setIsBigMapOpen] = useState(() => sessionStorage.getItem('isBigMapOpen') === 'true');

  useEffect(() => {
    sessionStorage.setItem('isBigMapOpen', String(isBigMapOpen));
  }, [isBigMapOpen]);

  // Redux state — only what this component needs to pick a background/skeleton;
  // each overlay panel (task/status/radar/propulsion/logs) selects its own slice.
  const {
    connectionStatus, heading, latitude, longitude, speed, videoStreamUrl, pathHistory, obstacles
  } = useSelector((state: RootState) => ({
    connectionStatus: state.telemetry.signal.strength > 0 ? 'connected' : 'disconnected',
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

      <div style={{
        position: 'absolute', top: '20px', left: '20px', right: '20px', zIndex: 10,
        display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'flex-start', columnGap: '16px'
      }}>
        <TaskManagementHUD />
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <CompassHUD heading={heading} />
        </div>
        <SystemStatusHUD />
      </div>

      <div style={{ position: 'absolute', bottom: '20px', left: '20px', right: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', zIndex: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {isBigMapOpen ? (
            <CameraHUD
              imageUrl={videoStreamUrl || placeholderSrc || '/main_example_background.png'}
              onClick={() => setIsBigMapOpen(false)}
            />
          ) : (
            <RadiusVisualizerPanel onClick={() => setIsBigMapOpen(true)} />
          )}
        </div>
        <EventLogsHUD title={title} />
        <ShipRudderVisualizerPanel />
      </div>
    </div>
  );
};

export default TelemetryDashboard;
