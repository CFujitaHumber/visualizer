/**
 * @file telemetryFactory.ts
 * 
 * @description
 * Factory functions for generating random telemetry data for testing and development purposes. 
 * This includes functions to create random telemetry states, as well as utilities for generating random values within specified ranges.
 * @author Carson Fujita
 * @license MIT 
 * @remarks
 * - The `generateRandomTelemetry` function creates a complete telemetry state with random values for all parameters, including speed, heading, battery levels, task data, and more.
 * - The `generateMockTelemetryUpdate` function takes a previous telemetry state and generates a new state with small random variations to simulate real-time updates.
 * - These factory functions are useful for testing the application's UI and functionality without needing a live connection to the basestation or actual telemetry data.
 *
 * @example
 * ```typescript
 * import { generateRandomTelemetry } from './telemetryFactory';
 * 
 * const randomTelemetry = generateRandomTelemetry();
 * console.log(randomTelemetry);
 * ```
 * 
 * @example
 * ```typescript
 * import { generateMockTelemetryUpdate } from './telemetryFactory';
 * 
 * let currentTelemetry = generateRandomTelemetry();
 * setInterval(() => {
 *     currentTelemetry = generateMockTelemetryUpdate(currentTelemetry);
 *     console.log(currentTelemetry);
 * }, 1000);
 * ```
 * 
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
import type { Status } from "../types/statusTypes";
import type { TaskData, TaskLocation } from "../types/taskTypes";
import type { DetectedObject } from "../types/detectedObjectsTypes";
import type { Path, Grid } from "react-isometric-engine";
import { CellTypes, InitialCell, TaskValues } from "../types";
import { ledForStatus } from "./led";
 
// clamp a value between a minimum and maximum
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// Generate a random number between min and max
const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);

// Generate a random integer between min and max (inclusive)
const randomInt = (min: number, max: number) => Math.floor(randomBetween(min, max + 1));

// Select a random item from an array
const randomChoice = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

// Generate a random step value for telemetry updates, which can be positive or negative
const randomStep = (minStep: number, maxStep: number) => randomBetween(minStep, maxStep) * (Math.random() < 0.5 ? -1 : 1);

// Wrap heading values to stay within 0-360 degrees
const wrapHeading = (heading: number) => {
    const wrapped = heading % 360;
    return wrapped < 0 ? wrapped + 360 : wrapped;
};

const njordTasks = [
    "Navigation Channel",
    "Obstacle Avoidance",
    "Acoustic Docking",
    "Object Delivery",
    "Speed Challenge",
    "Return to Home",
];

/**
 * creates a random TaskData object with random values for testing purposes.
 * @returns randomly generated TaskData object containing an id, name, status, latitude, and longitude.
 */
const createTaskData = (): TaskData => ({
    id: randomInt(1, 10),
    name: randomChoice(njordTasks),
    status: randomChoice(Object.values(TaskValues)),
    latitude: randomBetween(-90, 90),
    longitude: randomBetween(-180, 180),
});

/**
 * creates a TaskLocation object with random values for testing purposes.
 * @returns randomly generated TaskLocation object.
 */
const createTaskLocation = (): TaskLocation => ({
    id: `loc-${randomInt(100, 999)}`,
    latitude: randomBetween(-90, 90),
    longitude: randomBetween(-180, 180),
});

/**
 * Creates an array of random log entries for testing purposes.
 * @param count the number of log entries to generate.
 * @returns an array of randomly generated log entries.
 */
// const createLogEntries = (count: number) =>
//     Array.from({ length: count }, () => randomChoice(exampleLogData));
// const exampleLogData = [
//     "System initialized.",
//     "Sensors online.",
//     "Awaiting commands...",
// ];


/**
 * Creates a random occupancy grid for testing purposes.
 */
function createOccupanyGrid(width: number, height: number): Grid {
    return Array.from({ length: height }, () =>
        Array.from({ length: width }, () => ({ 
            ...InitialCell, 
            type: Math.random() < 0.15 ? CellTypes.occupied : CellTypes.empty 
        }))
    );
}

function createNavigationGrid(occupancyGrid: Grid): { navigationGrid: Grid; path: Path } {
    // For simplicity we will just copy the occupancy grid width and size with empty
    // then create a single ordered path and assign it to the navigation grid.
    const navigationGrid = occupancyGrid.map(row => row.map(() => ({ ...InitialCell, x: 0, y: 0, type: CellTypes.empty })));
    const path: Path = [];
    const width = occupancyGrid[0].length;
    const height = occupancyGrid.length;

    for (let i = 0; i < Math.max(width, height); i++) {
        const row = clamp(i + randomInt(-1, 1), 0, height - 1);
        const col = clamp(i + randomInt(-1, 1), 0, width - 1);
        const cell = { ...InitialCell, type: CellTypes.path, x: col, y: row };
        path.push(cell);
        navigationGrid[row][col] = { ...cell };
    }

    return { navigationGrid, path };
}

function createPlanning(navigationGrid: Grid, path: Path): { course: Path; plan: Path } {
    const course: Path = [];
    const plan: Path = [];
    const half = Math.floor(path.length / 2);
    const currentIndex = path.length <= 1 ? 0 : Math.min(half, path.length - 2);

    for (let i = 0; i <= currentIndex; i++) {
        course.push({ ...path[i], type: CellTypes.path });
    }
    for (let i = currentIndex; i < path.length; i++) {
        plan.push({ ...path[i], type: CellTypes.path });
    }

    const current = path[currentIndex] || { ...InitialCell, type: CellTypes.current, x: 0, y: 0 };
    const currentCell = { ...current, type: CellTypes.current };
    if (navigationGrid[current.y] && navigationGrid[current.y][current.x]) {
        navigationGrid[current.y][current.x] = currentCell;
    }

    const lastPathCell = path[path.length - 1] || current;
    if (lastPathCell.y !== current.y || lastPathCell.x !== current.x) {
        if (navigationGrid[lastPathCell.y] && navigationGrid[lastPathCell.y][lastPathCell.x]) {
            navigationGrid[lastPathCell.y][lastPathCell.x] = { ...lastPathCell, type: CellTypes.objective };
        }
    }

    return { course, plan };
}

const width = 20;
const height = 20;
export function generateRandomState(): Status {
    console.log("Generating random telemetry state...");
    const occupancyGrid = createOccupanyGrid(width, height);
    const { navigationGrid, path } = createNavigationGrid(occupancyGrid);
    const { course, plan } = createPlanning(navigationGrid, path);

    const taskData = createTaskData();
    // Hoisted so the mast light below can be derived from the same draw — picking
    // the status twice would let the lamp and the chip disagree.
    const planningStatus = randomChoice(Object.values(TaskValues));

    return {
        map: {
            occupancyGrid: occupancyGrid,
            navigationGrid: navigationGrid,
            courseTrail: [],
        },
        planning: {
            status: planningStatus,
            course: course,
            plan: plan,
        },
        task: {
            log: [`Found task ${taskData.id} doing task ${taskData.id} : ${taskData.name} [${new Date().toLocaleTimeString('en-US', { hour12: false })}]`],
            location: createTaskLocation(),
            data: taskData,
        },
        battery: {
            motors: randomBetween(35, 100),
            primary: randomBetween(35, 100),
        },
        rudder: {
            angle: randomBetween(-30, 30),
        },
        motors: {
            left: randomBetween(35, 100),
            right: randomBetween(35, 100),
        },
        asv: {
            speed: randomBetween(0, 5),
            heading: randomBetween(0, 360),
            longitude: randomBetween(-180, 180),
            latitude: randomBetween(-90, 90),
        },
        // Mast light, derived from the planning status above. An all-zero lamp would
        // classify as "lost connection" (see utils/led.ts), which is not what a
        // freshly-generated prototype state is meant to be showing.
        led: ledForStatus(planningStatus),
        signal: {
            strength: randomBetween(0, 100),
        },
        zed: {
            odom: { position: { x: 0, y: 0, z: 0 }, orientation: { roll: 0, pitch: 0, yaw: 0 } },
            objects: [],
            camera: { active: false, width: 0, height: 0, encoding: "" }
        },
        system: { topics: [] },
        // Client-only; latched from the first fix by telemetrySlice, not by the sim.
        frame: { originLatitude: 0, originLongitude: 0, hasOrigin: false },
    };
}

let targetHeading = Math.random() * 360;
let targetSpeed = 5;
let timeSinceLastTurn = 0;

/**
 * Generates a new state by applying small random variations to the previous state, simulating real-time updates.
 * @param previous the previous State to base the new state on.
 * @returns a new State object with updated values based on the previous state, 
 *  with random variations applied to simulate changes over time.
 */
let startCoords: { lat: number, lon: number } | null = null;
const measureLocalMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6378137;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const x = dLon * Math.cos((lat1 * Math.PI) / 180) * R;
  const y = dLat * R;
  return { x, y };
};

export function generateMockStateUpdate(previous: Status): Status {
    // Make the boat actually drive forward smoothly!
    // At 30FPS (33ms per tick), we adjust physics variables for continuous time.
    const dt = 33 / 1000;
    
    // Random wandering logic (change target heading and speed every few seconds)
    timeSinceLastTurn += 33;
    if (timeSinceLastTurn > 3000 && Math.random() < 0.02) {
        targetHeading = (previous.asv.heading + randomStep(45, 135)) % 360;
        
        // Randomly stop completely, or pick a new speed
        if (Math.random() < 0.2) {
            targetSpeed = 0;
        } else {
            targetSpeed = randomStep(2, 8);
        }
        
        timeSinceLastTurn = 0;
    }
    
    // Smoothly accelerate/decelerate towards targetSpeed
    const speedDiff = targetSpeed - previous.asv.speed;
    const acceleration = 1.0; // 1 m/s^2
    const speedChange = Math.sign(speedDiff) * Math.min(Math.abs(speedDiff), acceleration * dt);
    const newSpeed = clamp(previous.asv.speed + speedChange, 0, 8);
    
    // Steer towards target heading smoothly (max 30 degrees per second)
    let diff = targetHeading - previous.asv.heading;
    while (diff < -180) diff += 360;
    while (diff > 180) diff -= 360;
    
    const maxTurnPerFrame = 30 * dt;
    const turnRate = Math.sign(diff) * Math.min(Math.abs(diff), maxTurnPerFrame);
    const newHeading = wrapHeading(previous.asv.heading + turnRate);
    
    // Calculate new position
    const distMeters = newSpeed * dt; 
    const newLat = clamp(previous.asv.latitude + (distMeters * Math.cos(newHeading * Math.PI / 180)) / 111320, -90, 90);
    const newLon = clamp(previous.asv.longitude + (distMeters * Math.sin(newHeading * Math.PI / 180)) / 111320, -180, 180);

    // Track path history and obstacles
    if (!startCoords) startCoords = { lat: newLat, lon: newLon };
    const loc = measureLocalMeters(startCoords.lat, startCoords.lon, newLat, newLon);
    
    const nextPathHistory = [...(previous.map?.courseTrail || [])];
    const nextObstacles = [...(previous.zed?.objects || [])];
    let nextLogs = [...previous.task.log];

    const lastPoint = nextPathHistory[nextPathHistory.length - 1];
    if (!lastPoint || Math.hypot(lastPoint.x - loc.x, lastPoint.y - loc.y) > 1) {
        nextPathHistory.push({ x: loc.x, y: loc.y, heading: newHeading });
        if (nextPathHistory.length > 1000) nextPathHistory.shift();
        
        // Randomly drop an obstacle sometimes
        if (Math.random() < 0.05) {
            const angle = (newHeading + (Math.random() * 60 - 30)) * Math.PI / 180;
            const distance = Math.random() * 5 + 35; // Spawn at 40m edge
            const obsX = loc.x + distance * Math.sin(angle);
            const obsY = loc.y + distance * Math.cos(angle);
            const objTimeStr = new Date().toLocaleTimeString('en-US', { hour12: false });
            
            const newObj: DetectedObject = {
                position: { x: obsX, y: obsY, z: 0 },
                label: "Obstacle",
                label_id: 1,
                confidence: 0.9,
            };
            nextObstacles.push(newObj);
            if (nextObstacles.length > 200) nextObstacles.shift();
            
            nextLogs = [...nextLogs, `Found obstacle at (${obsX.toFixed(1)}, ${obsY.toFixed(1)}) [${objTimeStr}]`].slice(-10);
        }
    }

    // Tie physics variables directly to the boat's actual movement instead of random noise!
    const targetRudder = (turnRate / (30 * dt)) * 30; 
    // Thruster power is signed (-100 astern / 0 stopped / +100 ahead). This sim only
    // ever drives forward, so it produces positive power; the clamp keeps it inside the
    // contract when newSpeed overshoots the 8 kn reference.
    const targetPower = clamp((newSpeed / 8) * 100, -100, 100);
    
    // Battery drains slowly from 100 to 0, then resets to 100
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
            longitude: newLon,
            latitude: newLat,
        },
        task: {
            ...previous.task,
            log: nextLogs,
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