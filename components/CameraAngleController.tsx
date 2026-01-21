
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useTheme } from '../contexts/ThemeContext';

// --- Constants ---
const PINK = '#FF69B4';   // Horizontal
const CYAN = '#00FFFF';   // Vertical
const YELLOW = '#FCD34D'; // Zoom/Camera

const AZIMUTH_RADIUS = 3.5;
const ELEVATION_RADIUS = 3.5;
const ARC_OFFSET_X = -1.5; // Moved deeper inside
const ZOOM_MIN = 1;
const ZOOM_MAX = 10;

interface CameraState {
    horizontal: number;
    vertical: number;
    zoom: number;
    setHorizontal: (v: number) => void;
    setVertical: (v: number) => void;
    setZoom: (v: number) => void;
}

// --- 3D Components ---

const SceneGrid = () => (
    <gridHelper args={[20, 20, 0x333333, 0x111111]} position={[0, -1.01, 0]} />
);

const CenterCard = () => {
    const texture = useMemo(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = '#1a1a2a'; ctx.fillRect(0, 0, 256, 256);
            ctx.strokeStyle = '#2a2a3a'; ctx.lineWidth = 2;
            for (let i = 0; i <= 256; i += 32) {
                ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
            }
        }
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
        return tex;
    }, []);

    return (
        <group position={[0, 0, 0]}>
            <mesh position={[0, 0, 0]}>
                <boxGeometry args={[1.2, 1.6, 0.1]} />
                <meshStandardMaterial color="#222" />
            </mesh>
            <Html position={[0, 0, 0.06]} transform occlude="blending" center pointerEvents="none">
                <div className="flex items-center justify-center w-24 h-32 bg-[#1a1a1a] border border-white/10 select-none">
                    <span className="text-white/50 font-bold text-xs">圖片</span>
                </div>
            </Html>
            <mesh position={[0, 0, -0.06]} rotation={[0, Math.PI, 0]}>
                <planeGeometry args={[1.2, 1.6]} />
                <meshBasicMaterial map={texture} />
            </mesh>
        </group>
    );
};

// 3. Azimuth Control (Pink Ring)
const AzimuthControl = ({ horizontal, setHorizontal }: Pick<CameraState, 'horizontal' | 'setHorizontal'>) => {
    const isDragging = useRef(false);

    // Calculate Handle Pos
    const rad = (horizontal * Math.PI) / 180;
    const x = AZIMUTH_RADIUS * Math.sin(rad);
    const z = AZIMUTH_RADIUS * Math.cos(rad);

    const handlePointerDown = (e: any) => {
        e.stopPropagation();
        isDragging.current = true;
        e.target.setPointerCapture(e.pointerId);
    };

    const handlePointerUp = (e: any) => {
        isDragging.current = false;
        e.target.releasePointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: any) => {
        if (isDragging.current) {
            const point = e.point;
            // Calculate angle
            let deg = Math.atan2(point.x, point.z) * (180 / Math.PI);
            if (deg < 0) deg += 360;
            setHorizontal(deg);
        }
    };

    return (
        <group position={[0, -1, 0]}>
            {/* The Track Ring */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[AZIMUTH_RADIUS, 0.05, 32, 100]} />
                <meshBasicMaterial color={PINK} transparent opacity={0.8} />
            </mesh>

            {/* Hit Plane (Transparent but Visible for Raycaster) */}
            <mesh
                rotation={[Math.PI / 2, 0, 0]}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                visible={true} // Must be true for events
            >
                <planeGeometry args={[12, 12]} />
                <meshBasicMaterial color="red" transparent opacity={0} />
            </mesh>

            {/* The Handle Ball */}
            <mesh position={[x, 0, z]} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
                <sphereGeometry args={[0.3, 32, 32]} />
                <meshStandardMaterial color={PINK} emissive={PINK} emissiveIntensity={0.8} />
                <mesh scale={1.2}>
                    <sphereGeometry args={[0.3, 16, 16]} />
                    <meshBasicMaterial color={PINK} transparent opacity={0.3} />
                </mesh>
            </mesh>
        </group>
    );
};

// 4. Elevation Control (Cyan Arc)
const ElevationControl = ({ vertical, setVertical }: Pick<CameraState, 'vertical' | 'setVertical'>) => {
    const isDragging = useRef(false);

    const rad = (vertical * Math.PI) / 180;
    const y = ELEVATION_RADIUS * Math.sin(rad);
    const z = ELEVATION_RADIUS * Math.cos(rad);

    const handlePointerDown = (e: any) => {
        e.stopPropagation();
        isDragging.current = true;
        e.target.setPointerCapture(e.pointerId);
    };

    const handlePointerUp = (e: any) => {
        isDragging.current = false;
        e.target.releasePointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: any) => {
        if (isDragging.current) {
            const point = e.point;
            // Map position to angle
            // Arc is in YZ plane relative to the group position
            // But dragging on global space...
            // The Hit Plane is rotated correctly, so e.point should be local to it?
            // Wait, R3F raycasting on mesh gives point in World coordinates unless we use `e.uv`?
            // Actually `e.point` is world point.
            // Since we are dragging on a plane at x = ARC_OFFSET_X, the point.x should be ~ARC_OFFSET_X
            // We care about Y and Z.

            let deg = Math.atan2(point.y + 1, point.z) * (180 / Math.PI); // +1 because group is at -1 Y
            // But wait, group y is -1.
            // The plane is inside the group so it moves with it.
            // `e.point` is world space.
            // If group is at (X, -1, 0), then relative Y = worldY - (-1) = worldY + 1.
            // relative Z = worldZ.

            // Correction: let's use `u, v` or just map world point.
            let relY = point.y - (-1);
            let relZ = point.z;

            let angle = Math.atan2(relY, relZ) * (180 / Math.PI);
            angle = Math.max(-90, Math.min(90, angle));
            setVertical(angle);
        }
    };

    return (
        <group position={[ARC_OFFSET_X, -1, 0]}>
            {/* Arc Track */}
            <group rotation={[0, Math.PI / 2, 0]}>
                <mesh rotation={[0, 0, Math.PI / 2]}>
                    <torusGeometry args={[ELEVATION_RADIUS, 0.05, 16, 64, Math.PI]} />
                    <meshBasicMaterial color={CYAN} transparent opacity={0.8} />
                </mesh>
            </group>

            {/* Hit Plane (Transparent) */}
            <mesh
                rotation={[0, Math.PI / 2, 0]}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                visible={true}
            >
                <planeGeometry args={[10, 10]} />
                <meshBasicMaterial color="blue" transparent opacity={0} side={THREE.DoubleSide} />
            </mesh>

            {/* Handle Ball */}
            <mesh position={[0, y, z]} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
                <sphereGeometry args={[0.3, 32, 32]} />
                <meshStandardMaterial color={CYAN} emissive={CYAN} emissiveIntensity={0.8} />
                <mesh scale={1.2}>
                    <sphereGeometry args={[0.3, 16, 16]} />
                    <meshBasicMaterial color={CYAN} transparent opacity={0.3} />
                </mesh>
            </mesh>
        </group>
    );
};

// 5. Camera Indicator
const CameraIndicator = ({ horizontal, vertical, zoom, setZoom }: CameraState) => {
    const isDragging = useRef(false);
    const lastY = useRef(0);

    const azRad = (horizontal * Math.PI) / 180;
    const elRad = (vertical * Math.PI) / 180;

    // Beam End (Max Zoom visual)
    const maxLen = 6;
    const bx = maxLen * Math.sin(azRad) * Math.cos(elRad);
    const by = maxLen * Math.sin(elRad);
    const bz = maxLen * Math.cos(azRad) * Math.cos(elRad);
    const beamEnd = new THREE.Vector3(bx, by, bz);

    // Ball Pos
    const dist = 1.5 + ((zoom - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN)) * 4.5;
    const cx = dist * Math.sin(azRad) * Math.cos(elRad);
    const cy = dist * Math.sin(elRad);
    const cz = dist * Math.cos(azRad) * Math.cos(elRad);

    // Logic: Drag up/down to zoom
    const handlePointerDown = (e: any) => {
        e.stopPropagation();
        isDragging.current = true;
        lastY.current = e.clientY;
        e.target.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: any) => {
        if (isDragging.current) {
            const delta = (lastY.current - e.clientY);
            lastY.current = e.clientY;
            setZoom(prev => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, prev + delta * 0.1)));
        }
    };

    const handlePointerUp = (e: any) => {
        isDragging.current = false;
        e.target.releasePointerCapture(e.pointerId);
    };

    return (
        <group>
            {/* Beam */}
            <mesh position={[bx / 2, by / 2, bz / 2]}
                quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), beamEnd.clone().normalize())}>
                <cylinderGeometry args={[0.05, 0.05, maxLen, 8]} />
                <meshBasicMaterial color={YELLOW} transparent opacity={0.6} />
            </mesh>

            {/* Camera Ball */}
            <group position={[cx, cy, cz]} lookAt={new THREE.Vector3(0, 0, 0)}>
                <mesh
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                >
                    <sphereGeometry args={[0.3, 32, 32]} />
                    <meshStandardMaterial color={YELLOW} emissive={YELLOW} emissiveIntensity={0.8} />
                </mesh>
                <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.4]}>
                    <coneGeometry args={[0.2, 0.4, 16]} />
                    <meshStandardMaterial color={YELLOW} emissive={YELLOW} emissiveIntensity={0.6} />
                </mesh>
            </group>
        </group>
    );
};

export const CameraAngleController: React.FC<{ onApply: (p: string) => void }> = ({ onApply }) => {
    const [horizontal, setHorizontal] = useState(45);
    const [vertical, setVertical] = useState(30);
    const [zoom, setZoom] = useState(5.0);
    const [prompt, setPrompt] = useState('');

    const getPrompt = useCallback(() => {
        let hPrompt = 'front view';
        const h = (horizontal % 360 + 360) % 360;
        if (h >= 22.5 && h < 67.5) hPrompt = 'front-right quarter view';
        else if (h >= 67.5 && h < 112.5) hPrompt = 'right side view';
        else if (h >= 112.5 && h < 157.5) hPrompt = 'back-right quarter view';
        else if (h >= 157.5 && h < 202.5) hPrompt = 'back view';
        else if (h >= 202.5 && h < 247.5) hPrompt = 'back-left quarter view';
        else if (h >= 247.5 && h < 292.5) hPrompt = 'left side view';
        else if (h >= 292.5 && h < 337.5) hPrompt = 'front-left quarter view';

        let vPrompt = 'eye-level shot';
        if (vertical < -45) vPrompt = 'worm\'s-eye view';
        else if (vertical >= -45 && vertical < -15) vPrompt = 'low-angle shot';
        else if (vertical > 15 && vertical <= 60) vPrompt = 'high-angle shot';
        else if (vertical > 60) vPrompt = 'bird\'s-eye view';

        let zPrompt = 'medium shot';
        if (zoom > 7) zPrompt = 'close-up';
        else if (zoom < 3) zPrompt = 'wide shot';

        return `<sks> ${hPrompt}, ${vPrompt}, ${zPrompt}`;
    }, [horizontal, vertical, zoom]);

    useEffect(() => { setPrompt(getPrompt()); }, [getPrompt]);

    return (
        <div className="flex flex-col bg-[#0f1014] text-white h-full font-sans select-none">
            {/* Top Sliders */}
            <div className="p-3 border-b border-white/5 bg-[#131419] space-y-2">
                <div className="relative h-5 bg-[#2a2b36] rounded overflow-hidden">
                    <div className="absolute inset-y-0 left-0 bg-pink-500/30" style={{ width: `${((horizontal % 360 + 360) % 360) / 3.6}%` }} />
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] space-x-2">
                        <span className="text-gray-400">水平</span><span style={{ color: PINK }}>{Math.round((horizontal % 360 + 360) % 360)}°</span>
                    </div>
                    <input type="range" min="0" max="360" value={(horizontal % 360 + 360) % 360} onChange={e => setHorizontal(Number(e.target.value))} className="absolute inset-0 opacity-0 cursor-ew-resize" />
                </div>
                <div className="relative h-5 bg-[#2a2b36] rounded overflow-hidden">
                    <div className="absolute inset-y-0 left-0 bg-cyan-500/30" style={{ width: `${(vertical + 90) / 1.8}%` }} />
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] space-x-2">
                        <span className="text-gray-400">垂直</span><span style={{ color: CYAN }}>{Math.round(vertical)}°</span>
                    </div>
                    <input type="range" min="-90" max="90" value={vertical} onChange={e => setVertical(Number(e.target.value))} className="absolute inset-0 opacity-0 cursor-ew-resize" />
                </div>
                <div className="relative h-5 bg-[#2a2b36] rounded overflow-hidden">
                    <div className="absolute inset-y-0 left-0 bg-yellow-500/30" style={{ width: `${(zoom - 1) / 0.09}%` }} />
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] space-x-2">
                        <span className="text-gray-400">縮放</span><span style={{ color: YELLOW }}>{zoom.toFixed(1)}</span>
                    </div>
                    <input type="range" min="1" max="10" step="0.1" value={zoom} onChange={e => setZoom(Number(e.target.value))} className="absolute inset-0 opacity-0 cursor-ew-resize" />
                </div>
            </div>

            {/* Prompt */}
            <div className="px-3 pt-2">
                <div className="p-2 bg-black/30 border border-white/10 rounded text-center">
                    <code className="text-[10px] text-pink-400">{prompt}</code>
                </div>
            </div>

            {/* 3D Scene */}
            <div className="flex-1 relative cursor-default bg-[#050505] min-h-[150px]">
                <Canvas camera={{ position: [32, 24, 32], fov: 35 }}>
                    <color attach="background" args={['#050505']} />

                    <ambientLight intensity={0.5} />
                    <directionalLight position={[10, 10, 5]} intensity={1} />
                    <directionalLight position={[-10, 5, -5]} intensity={0.5} color={PINK} />

                    <SceneGrid />
                    <CenterCard />

                    <AzimuthControl horizontal={horizontal} setHorizontal={setHorizontal} />
                    <ElevationControl vertical={vertical} setVertical={setVertical} />
                    <CameraIndicator horizontal={horizontal} vertical={vertical} zoom={zoom} setZoom={setZoom} setHorizontal={() => { }} setVertical={() => { }} />
                </Canvas>

                <button
                    onClick={() => { setHorizontal(45); setVertical(30); setZoom(5.0); }}
                    className="absolute bottom-2 right-2 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white/70"
                >
                    ⟳
                </button>
            </div>

            <div className="p-3 bg-[#0a0a0c]">
                <button onClick={() => onApply(prompt)} className="w-full py-2 bg-gradient-to-r from-pink-600 to-purple-600 rounded text-xs font-bold uppercase tracking-wider">
                    應用到提示詞
                </button>
            </div>
        </div>
    );
};
