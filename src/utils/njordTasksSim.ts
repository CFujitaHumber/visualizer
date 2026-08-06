import type { Status } from '../types/statusTypes';
import type { DetectedObject } from "../types/detectedObjectsTypes";
import { TaskValues } from "../types";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const wrapHeading = (heading: number) => {
    const wrapped = heading % 360;
    return wrapped < 0 ? wrapped + 360 : wrapped;
};

// --- Physics Constants ---
const MAX_SPEED = 5; // m/s
const ACCELERATION = 1.0; // m/s^2
const MAX_TURN_RATE = 30; // deg/sec

// --- Map Constraints ---
const MAP_BOUNDS = { minX: -200, maxX: 400, minY: -100, maxY: 400 };

export const njordTasks = [
    "Calibration", // 0
    "Navigation Channel", // 1
    "Obstacle Avoidance", // 2
    "Speed Challenge", // 3
    "Acoustic Docking", // 4
    "Object Delivery", // 5
    "Return to Home", // 6
];

// --- Predefined Auto Path ---
const PREDEFINED_PATH = [
    { x: 0, y: 10 },    // Start moving up
    { x: 0, y: 100 },   // Through Nav Channel
    { x: 25, y: 115 },  // Swerve LEFT of the obstacle field
    { x: 75, y: 130 },  // Swerve RIGHT of the obstacle field
    { x: 100, y: 140 }, // Approach Speed Challenge
    { x: 100, y: 220 }, // Speed challenge turnaround
    { x: 120, y: 220 }, // Loop back
    { x: 120, y: 140 }, // Speed challenge exit
    { x: 150, y: 120 }, // Approach Docking
    { x: 150, y: 90 },  // Inside Docking
    { x: 150, y: 70 },  // Leave Docking
    { x: 150, y: 30 },  // Object Delivery
    { x: 75, y: 0 },    // Waypoint home
    { x: 0, y: 0 },     // Home
];

// --- Internal Sim State ---
let currentTaskIndex = 0;
let simTime = 0;
let manualMode = false;
let simRunning = false;
let startCoords: { lat: number, lon: number } | null = null;
let prevManualMode = false;
let returningToAuto = false;
let lastAutoPos = { x: 0, y: 0 };
let currentPathIndex = 0;

// Track task specific states
let taskState = { step: 0, timer: 0 };

export const setSimRunning = (r: boolean) => simRunning = r;
export const getSimRunning = () => simRunning;

// Manual controls
export const manualControls = {
    targetSpeed: 0,
    targetHeading: 0,
    rudderPct: 0,
    powerPct: 0
};

export const setManualMode = (active: boolean) => {
    manualMode = active;
};
export const getManualMode = () => manualMode;

export const setTaskIndex = (index: number) => {
    currentTaskIndex = index % njordTasks.length;
    taskState = { step: 0, timer: 0 };
    simTime = 0;
    simRunning = false; // Pause when changing tasks manually
    return currentTaskIndex;
};
export const getTaskIndex = () => currentTaskIndex;

const measureLocalMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6378137;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const x = dLon * Math.cos((lat1 * Math.PI) / 180) * R;
  const y = dLat * R;
  return { x, y };
};

const unmeasureLocalMeters = (lat1: number, lon1: number, dx: number, dy: number) => {
  const R = 6378137;
  const newLat = lat1 + (dy / R) * (180 / Math.PI);
  const newLon = lon1 + (dx / (R * Math.cos((lat1 * Math.PI) / 180))) * (180 / Math.PI);
  return { lat: clamp(newLat, -90, 90), lon: clamp(newLon, -180, 180) };
};

let worldObstacles: DetectedObject[] = [];

export function generateTaskObstacles() {
    worldObstacles = [];
    const step = 40;
    
    // Massive boundary box
    for (let x = MAP_BOUNDS.minX; x <= MAP_BOUNDS.maxX; x += step) {
        worldObstacles.push({ position: { x, y: MAP_BOUNDS.minY, z: 0 }, label: "Boundary Buoy", label_id: 2, confidence: 1.0 });
        worldObstacles.push({ position: { x, y: MAP_BOUNDS.maxY, z: 0 }, label: "Boundary Buoy", label_id: 2, confidence: 1.0 });
    }
    for (let y = MAP_BOUNDS.minY + step; y < MAP_BOUNDS.maxY; y += step) {
        worldObstacles.push({ position: { x: MAP_BOUNDS.minX, y, z: 0 }, label: "Boundary Buoy", label_id: 2, confidence: 1.0 });
        worldObstacles.push({ position: { x: MAP_BOUNDS.maxX, y, z: 0 }, label: "Boundary Buoy", label_id: 2, confidence: 1.0 });
    }

    // Home Dock at (0,0)
    worldObstacles.push({ position: { x: -4, y: -2, z: 0 }, label: "Home Dock", label_id: 3, confidence: 1.0 });
    worldObstacles.push({ position: { x: -4, y: -10, z: 0 }, label: "Home Dock", label_id: 3, confidence: 1.0 });
    worldObstacles.push({ position: { x: 4, y: -2, z: 0 }, label: "Home Dock", label_id: 3, confidence: 1.0 });
    worldObstacles.push({ position: { x: 4, y: -10, z: 0 }, label: "Home Dock", label_id: 3, confidence: 1.0 });
    worldObstacles.push({ position: { x: 0, y: -10, z: 0 }, label: "Home Dock", label_id: 3, confidence: 1.0 });

    // Task 1: Navigation Channel (0, 30 -> 90)
    const chYStart = 30;
    for (let i = 0; i < 4; i++) {
        worldObstacles.push({ position: { x: -12, y: chYStart + i * 20, z: 0 }, label: "Nav Red", label_id: 1, confidence: 1.0 });
        worldObstacles.push({ position: { x: 12, y: chYStart + i * 20, z: 0 }, label: "Nav Green", label_id: 1, confidence: 1.0 });
    }

    // Task 2: Obstacle Avoidance (50, 120)
    const obX = 50, obY = 120;
    const offsets = [
        [-15, 0], [15, 5], [0, 15], [-10, 20], [10, -15], [5, -5]
    ];
    offsets.forEach(([dx, dy]) => {
        worldObstacles.push({ position: { x: obX + dx, y: obY + dy, z: 0 }, label: "Obstacle", label_id: 1, confidence: 1.0 });
    });

    // Task 3: Speed Challenge (100, 150)
    const spdX = 100, spdY = 150;
    worldObstacles.push({ position: { x: spdX - 15, y: spdY, z: 0 }, label: "Speed Gate", label_id: 1, confidence: 1.0 });
    worldObstacles.push({ position: { x: spdX + 15, y: spdY, z: 0 }, label: "Speed Gate", label_id: 1, confidence: 1.0 });
    worldObstacles.push({ position: { x: spdX + 10, y: spdY + 70, z: 0 }, label: "Turnaround Buoy", label_id: 1, confidence: 1.0 });

    // Task 4: Acoustic Docking (150, 100)
    const dockX = 150, dockY = 100;
    worldObstacles.push({ position: { x: dockX - 15, y: dockY - 10, z: 0 }, label: "Dock Buoy", label_id: 1, confidence: 1.0 });
    worldObstacles.push({ position: { x: dockX - 15, y: dockY + 15, z: 0 }, label: "Dock Buoy", label_id: 1, confidence: 1.0 });
    worldObstacles.push({ position: { x: dockX + 15, y: dockY - 10, z: 0 }, label: "Dock Buoy", label_id: 1, confidence: 1.0 });
    worldObstacles.push({ position: { x: dockX + 15, y: dockY + 15, z: 0 }, label: "Dock Buoy", label_id: 1, confidence: 1.0 });
    worldObstacles.push({ position: { x: dockX, y: dockY + 15, z: 0 }, label: "Acoustic Beacon", label_id: 1, confidence: 1.0 });
    
    // Task 5: Object Delivery (150, 40)
    const delX = 150, delY = 40;
    for (let i = 0; i < 6; i++) {
        worldObstacles.push({ position: { x: delX + Math.cos(i * Math.PI / 3) * 15, y: delY + Math.sin(i * Math.PI / 3) * 15, z: 0 }, label: "Island", label_id: 1, confidence: 1.0 });
    }
}

// Initial generator
export function generateRandomState(): Status {
    startCoords = { lat: 43.728, lon: -79.608 };
    simTime = 0;
    taskState = { step: 0, timer: 0 };
    currentPathIndex = 0;
    returningToAuto = false;
    
    generateTaskObstacles();

    return {
        map: {
            occupancyGrid: [],
            navigationGrid: [],
            courseTrail: [{ x: 0, y: 0, heading: 0 }],
        },
        planning: {
            status: manualMode ? TaskValues.standby : TaskValues.autonomous,
            course: [],
            plan: [],
        },
        task: {
            log: [`Sim initialized. [${new Date().toLocaleTimeString('en-US', { hour12: false })}]`],
            location: { id: "0", latitude: startCoords.lat, longitude: startCoords.lon },
            data: { id: currentTaskIndex, name: njordTasks[currentTaskIndex], status: manualMode ? TaskValues.standby : TaskValues.autonomous, latitude: 0, longitude: 0 },
        },
        battery: { motors: 100, primary: 100 },
        rudder: { angle: 0 },
        motors: { left: 0, right: 0 },
        asv: {
            speed: 0,
            heading: 0,
            longitude: startCoords.lon,
            latitude: startCoords.lat,
        },
        signal: { strength: 100 },
        zed: {
            odom: { position: { x: 0, y: 0, z: 0 }, orientation: { roll: 0, pitch: 0, yaw: 0 } },
            objects: [],
            camera: { active: false, width: 0, height: 0, encoding: "" }
        }
    };
}

export function generateMockStateUpdate(previous: Status): Status {
    const dt = 33 / 1000;
    simTime += dt;
    
    if (!startCoords) {
        startCoords = { lat: previous.asv.latitude, lon: previous.asv.longitude };
    }

    const loc = measureLocalMeters(startCoords.lat, startCoords.lon, previous.asv.latitude, previous.asv.longitude);
    
    // Pause / Return to auto logic
    if (manualMode && !prevManualMode) {
        lastAutoPos = { x: loc.x, y: loc.y };
        returningToAuto = false;
    }
    if (!manualMode && prevManualMode) {
        returningToAuto = true;
    }
    prevManualMode = manualMode;

    let targetSpeed = manualMode ? manualControls.targetSpeed : 0;
    let targetHeading = previous.asv.heading;
    let targetRudder = manualMode ? manualControls.rudderPct : 0;
    
    let nextLogs = [...previous.task.log];
    const nextObstacles = [...previous.zed.objects];

    // --- Autonomous Logic ---
    if (!manualMode && simRunning) {
        if (currentTaskIndex === 0) {
            // Calibration
            if (taskState.step === 0) {
                targetSpeed = MAX_SPEED;
                targetHeading = wrapHeading(previous.asv.heading + 90);
                if (simTime > 5) {
                    taskState.step = 1;
                    nextLogs = [...nextLogs, `Calibration: Port complete. [${new Date().toLocaleTimeString('en-US', { hour12: false })}]`].slice(-10);
                }
            } else if (taskState.step === 1) {
                targetSpeed = MAX_SPEED;
                targetHeading = wrapHeading(previous.asv.heading - 90);
                if (simTime > 10) {
                    taskState.step = 2;
                    nextLogs = [...nextLogs, `Calibration: Stbd complete. [${new Date().toLocaleTimeString('en-US', { hour12: false })}]`].slice(-10);
                }
            } else if (taskState.step === 2) {
                targetSpeed = MAX_SPEED;
                targetHeading = 0; // Go North
                if (simTime > 13) {
                    currentTaskIndex = 1;
                    taskState = { step: 0, timer: 0 };
                    nextLogs = [...nextLogs, `Calibration Complete. Starting route. [${new Date().toLocaleTimeString('en-US', { hour12: false })}]`].slice(-10);
                }
            }
        } else {
            // Path Following
            let tx, ty;
            const target = PREDEFINED_PATH[currentPathIndex];
            
            if (returningToAuto) {
                tx = lastAutoPos.x;
                ty = lastAutoPos.y;
                const distToReturn = Math.hypot(tx - loc.x, ty - loc.y);
                if (distToReturn < 2) {
                    returningToAuto = false; // reached resume point
                    nextLogs = [...nextLogs, `Resuming autonomous path. [${new Date().toLocaleTimeString('en-US', { hour12: false })}]`].slice(-10);
                }
            } else {
                if (target) {
                    tx = target.x;
                    ty = target.y;
                    const distToTarget = Math.hypot(tx - loc.x, ty - loc.y);
                    if (distToTarget < 5) {
                        currentPathIndex++;
                        if (currentPathIndex >= PREDEFINED_PATH.length) {
                            simRunning = false;
                            nextLogs = [...nextLogs, `Route Complete. Auto Paused. [${new Date().toLocaleTimeString('en-US', { hour12: false })}]`].slice(-10);
                        } else {
                            // Update UI Task if we reach certain Y levels approx
                            if (currentPathIndex === 2) currentTaskIndex = 2; // Obstacles
                            if (currentPathIndex === 3) currentTaskIndex = 3; // Speed
                            if (currentPathIndex === 7) currentTaskIndex = 4; // Docking
                            if (currentPathIndex === 10) currentTaskIndex = 5; // Delivery
                            if (currentPathIndex === 11) currentTaskIndex = 6; // Home
                        }
                    }
                } else {
                    tx = loc.x; ty = loc.y; // stop
                }
            }

            const dx = tx - loc.x;
            const dy = ty - loc.y;
            
            if (simRunning) {
                targetSpeed = 4;
                let desiredAngle = Math.atan2(dx, dy) * (180 / Math.PI);
                if (desiredAngle < 0) desiredAngle += 360;
                targetHeading = desiredAngle;
            } else {
                targetSpeed = 0;
            }
        }
    } else if (!manualMode && !simRunning) {
        targetSpeed = 0;
        targetRudder = 0;
    }

    // --- Physics Kinematics ---
    const speedDiff = targetSpeed - previous.asv.speed;
    const speedChange = Math.sign(speedDiff) * Math.min(Math.abs(speedDiff), ACCELERATION * dt);
    const newSpeed = clamp(previous.asv.speed + speedChange, 0, MAX_SPEED);
    
    let turnRate = 0;
    if (manualMode) {
        turnRate = (targetRudder / 30) * MAX_TURN_RATE * dt * (newSpeed > 0.1 ? 1 : 0);
    } else {
        let diff = targetHeading - previous.asv.heading;
        while (diff < -180) diff += 360;
        while (diff > 180) diff -= 360;
        const maxTurnPerFrame = MAX_TURN_RATE * dt;
        turnRate = Math.sign(diff) * Math.min(Math.abs(diff), maxTurnPerFrame);
        targetRudder = (turnRate / (MAX_TURN_RATE * dt)) * 30; 
    }
    
    // Wave dynamics and drift
    if (newSpeed > 0.1 || targetSpeed > 0.1) {
        targetRudder += Math.sin(simTime * 2.5) * 3 + Math.sin(simTime * 1.1) * 2;
        turnRate += Math.sin(simTime * 2.5) * (MAX_TURN_RATE * dt * 0.15);
        targetSpeed += Math.sin(simTime * 0.8) * 0.05 + Math.sin(simTime * 3.1) * 0.02;
    }
    
    const newHeading = wrapHeading(previous.asv.heading + turnRate);
    
    const distMeters = newSpeed * dt;
    const dx = distMeters * Math.sin(newHeading * Math.PI / 180);
    const dy = distMeters * Math.cos(newHeading * Math.PI / 180);
    
    const newLocX = loc.x + dx;
    const newLocY = loc.y + dy;
    
    const newCoords = unmeasureLocalMeters(startCoords.lat, startCoords.lon, newLocX, newLocY);

    // Track path history
    const nextPathHistory = [...(previous.map?.courseTrail || [])];
    const lastPoint = nextPathHistory[nextPathHistory.length - 1];
    if (!lastPoint || Math.hypot(lastPoint.x - newLocX, lastPoint.y - newLocY) > 1) {
        nextPathHistory.push({ x: newLocX, y: newLocY, heading: newHeading });
        if (nextPathHistory.length > 2000) nextPathHistory.shift();
    }
    
    // Discover obstacles
    worldObstacles.forEach(obs => {
        const ox = obs.position?.x ?? 0;
        const oy = obs.position?.y ?? 0;
        const dx = ox - newLocX;
        const dy = oy - newLocY;
        const dist = Math.hypot(dx, dy);
        
        if (dist < 40) {
            // Check if within +/- 30 degrees (Math.PI / 6) of heading
            // In our coordinate system: +Y is North/Up, +X is East/Right
            // Heading is 0=North, 90=East.
            let angleToObs = Math.atan2(dx, dy) * (180 / Math.PI);
            if (angleToObs < 0) angleToObs += 360;
            
            let angleDiff = Math.abs(angleToObs - newHeading);
            while (angleDiff > 180) angleDiff = Math.abs(angleDiff - 360);
            
            if (angleDiff <= 30) {
                const alreadyMapped = nextObstacles.some(mapped => 
                    (mapped.position?.x === ox) && (mapped.position?.y === oy)
                );
                if (!alreadyMapped) {
                    nextObstacles.push(obs);
                    if (obs.label !== "Boundary Buoy") {
                        nextLogs = [...nextLogs, `Mapped: ${obs.label} at (${Math.round(ox)}, ${Math.round(oy)}). [${new Date().toLocaleTimeString('en-US', { hour12: false })}]`].slice(-10);
                    }
                }
            }
        }
    });

    const targetPower = (newSpeed / MAX_SPEED) * 100;
    
    let newBattery = previous.battery.primary - (0.5 * dt);
    if (newBattery <= 0) newBattery = 100;

    return {
        ...previous,
        battery: { ...previous.battery, primary: newBattery },
        motors: { left: targetPower, right: targetPower },
        rudder: { angle: clamp(targetRudder, -30, 30) },
        asv: {
            speed: newSpeed,
            heading: newHeading,
            longitude: newCoords.lon,
            latitude: newCoords.lat,
        },
        task: {
            ...previous.task,
            log: nextLogs,
            data: { ...previous.task.data, id: currentTaskIndex, name: njordTasks[currentTaskIndex], status: manualMode ? TaskValues.standby : TaskValues.autonomous }
        },
        planning: {
            ...previous.planning,
            status: manualMode ? TaskValues.standby : TaskValues.autonomous
        },
        map: {
            ...previous.map,
            courseTrail: nextPathHistory,
        },
        zed: {
            ...previous.zed,
            objects: nextObstacles,
        }
    };
}

export default generateRandomState;
