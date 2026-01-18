import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';

interface MultiAngle3DProps {
  rotate: number;
  vertical: number;
  zoom: number;
  onChange: (params: { rotate?: number; vertical?: number; zoom?: number }) => void;
  imageUrl?: string;
  width?: number;
  height?: number;
  onRun?: () => void;
  isRunning?: boolean;
  onExecute?: () => void;
}

const MultiAngle3D: React.FC<MultiAngle3DProps> = ({
  rotate,
  vertical,
  zoom,
  onChange,
  imageUrl,
  width = 280,
  height = 200,
  onRun,
  isRunning = false,
  onExecute,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const imageGroupRef = useRef<THREE.Group | null>(null);
  const hBallRef = useRef<THREE.Mesh | null>(null);
  const vBallRef = useRef<THREE.Mesh | null>(null);
  const zBallRef = useRef<THREE.Mesh | null>(null);
  const animationIdRef = useRef<number | null>(null);
  
  const [dragging, setDragging] = useState<'h' | 'v' | 'z' | 'orbit' | null>(null);
  const [hovered, setHovered] = useState<'h' | 'v' | 'z' | null>(null);
  const lastMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // 初始化 3D 場景
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // 場景
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080810);
    sceneRef.current = scene;

    // 相機 - 固定位置觀察
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 1.5, 4);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // 渲染器
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 環境光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    // 方向光
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);

    // 網格地面
    const gridHelper = new THREE.GridHelper(6, 20, 0x1e3a5f, 0x0f1a2a);
    gridHelper.position.y = -1.2;
    scene.add(gridHelper);

    // 水平圓環軌道
    const hRingGeometry = new THREE.TorusGeometry(1.8, 0.02, 8, 64);
    const hRingMaterial = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.4 });
    const hRing = new THREE.Mesh(hRingGeometry, hRingMaterial);
    hRing.rotation.x = Math.PI / 2;
    hRing.position.y = -0.5;
    scene.add(hRing);

    // 垂直弧線軌道
    const vArcCurve = new THREE.EllipseCurve(0, 0, 1.5, 1.5, -Math.PI / 6, Math.PI / 2 + 0.1, false, 0);
    const vArcPoints = vArcCurve.getPoints(50);
    const vArcGeometry = new THREE.BufferGeometry().setFromPoints(
      vArcPoints.map(p => new THREE.Vector3(p.x, p.y, 0))
    );
    const vArcMaterial = new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.5 });
    const vArc = new THREE.Line(vArcGeometry, vArcMaterial);
    scene.add(vArc);

    // 圖片組 - 用於整體旋轉
    const imageGroup = new THREE.Group();
    scene.add(imageGroup);
    imageGroupRef.current = imageGroup;

    // 圖片平面 - 帶邊框效果
    const planeGeometry = new THREE.PlaneGeometry(1.6, 1.6);
    const planeMaterial = new THREE.MeshBasicMaterial({
      color: 0x1a1a2e,
      side: THREE.DoubleSide,
    });
    const imagePlane = new THREE.Mesh(planeGeometry, planeMaterial);
    imagePlane.name = 'imagePlane';
    imageGroup.add(imagePlane);

    // 圖片邊框
    const borderGeometry = new THREE.EdgesGeometry(new THREE.PlaneGeometry(1.7, 1.7));
    const borderMaterial = new THREE.LineBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.6 });
    const border = new THREE.LineSegments(borderGeometry, borderMaterial);
    imageGroup.add(border);

    // 水平控制球（藍色）
    const hBallGeometry = new THREE.SphereGeometry(0.12, 16, 16);
    const hBallMaterial = new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x1e40af, emissiveIntensity: 0.3 });
    const hBall = new THREE.Mesh(hBallGeometry, hBallMaterial);
    hBall.userData.type = 'h';
    hBall.position.y = -0.5;
    scene.add(hBall);
    hBallRef.current = hBall;

    // 垂直控制球（青色）
    const vBallGeometry = new THREE.SphereGeometry(0.1, 16, 16);
    const vBallMaterial = new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x0891b2, emissiveIntensity: 0.3 });
    const vBall = new THREE.Mesh(vBallGeometry, vBallMaterial);
    vBall.userData.type = 'v';
    scene.add(vBall);
    vBallRef.current = vBall;

    // 縮放控制球（黃色）- 放在圖片前方
    const zBallGeometry = new THREE.SphereGeometry(0.08, 16, 16);
    const zBallMaterial = new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xb45309, emissiveIntensity: 0.3 });
    const zBall = new THREE.Mesh(zBallGeometry, zBallMaterial);
    zBall.userData.type = 'z';
    scene.add(zBall);
    zBallRef.current = zBall;

    // 動畫迴圈
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [width, height]);

  // 載入圖片紋理
  useEffect(() => {
    if (!imageGroupRef.current || !imageUrl) return;
    
    const loader = new THREE.TextureLoader();
    loader.load(imageUrl, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      const imagePlane = imageGroupRef.current?.getObjectByName('imagePlane') as THREE.Mesh;
      if (imagePlane) {
        // 根據圖片比例調整平面大小
        const aspect = texture.image.width / texture.image.height;
        let planeW = 1.6, planeH = 1.6;
        if (aspect > 1) {
          planeH = planeW / aspect;
        } else {
          planeW = planeH * aspect;
        }
        imagePlane.geometry = new THREE.PlaneGeometry(planeW, planeH);
        imagePlane.material = new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.DoubleSide,
        });
      }
    });
  }, [imageUrl]);

  // 更新場景元素位置
  useEffect(() => {
    if (!imageGroupRef.current || !hBallRef.current || !vBallRef.current || !zBallRef.current) return;

    const hAngleRad = (rotate * Math.PI) / 180;
    const vAngleRad = (vertical * Math.PI) / 180;

    // 圖片組旋轉 - 水平繞Y軸，垂直繞X軸
    imageGroupRef.current.rotation.y = -hAngleRad;
    imageGroupRef.current.rotation.x = vAngleRad;

    // 圖片縮放 - 根據 zoom 調整
    const scale = 0.6 + (zoom / 10) * 0.8;
    imageGroupRef.current.scale.setScalar(scale);

    // 水平球位置 - 在底部圓環上
    hBallRef.current.position.set(
      Math.sin(hAngleRad) * 1.8,
      -0.5,
      Math.cos(hAngleRad) * 1.8
    );

    // 垂直球位置 - 在垂直弧線上
    vBallRef.current.position.set(
      Math.cos(vAngleRad) * 1.5,
      Math.sin(vAngleRad) * 1.5,
      0
    );

    // 縮放球位置 - 在圖片前方
    const zDist = 0.5 + (zoom / 10) * 1.2;
    zBallRef.current.position.set(0, 0, zDist);

  }, [rotate, vertical, zoom]);

  // 更新球體顏色
  useEffect(() => {
    if (hBallRef.current) {
      const mat = hBallRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = dragging === 'h' || hovered === 'h' ? 0.8 : 0.3;
    }
    if (vBallRef.current) {
      const mat = vBallRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = dragging === 'v' || hovered === 'v' ? 0.8 : 0.3;
    }
    if (zBallRef.current) {
      const mat = zBallRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = dragging === 'z' || hovered === 'z' ? 0.8 : 0.3;
    }
  }, [dragging, hovered]);

  // 計算拖拽靈敏度 - 考慮弧線位置和透視
  const getSensitivity = useCallback((type: 'h' | 'v' | 'z') => {
    if (type === 'h') {
      // 水平：接近極點時靈敏度要提高
      const vRad = Math.abs(vertical * Math.PI / 180);
      const cosFactor = Math.cos(vRad);
      return 0.5 / Math.max(cosFactor, 0.3); // 避免除以0
    }
    if (type === 'v') {
      // 垂直：弧線末端靈敏度略高
      return 0.5;
    }
    return 0.05; // zoom
  }, [vertical]);

  // 滑鼠按下
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!containerRef.current || !cameraRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / width) * 2 - 1,
      -((e.clientY - rect.top) / height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);
    const balls = [hBallRef.current, vBallRef.current, zBallRef.current].filter(Boolean) as THREE.Mesh[];
    const intersects = raycaster.intersectObjects(balls);

    if (intersects.length > 0) {
      setDragging(intersects[0].object.userData.type);
    } else {
      // 點選空白處 - 自由旋轉模式
      setDragging('orbit');
    }
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  }, [width, height]);

  // 滑鼠移動
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!containerRef.current || !cameraRef.current) return;

    const deltaX = e.clientX - lastMouseRef.current.x;
    const deltaY = e.clientY - lastMouseRef.current.y;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };

    // 檢測懸停
    if (!dragging) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / width) * 2 - 1,
        -((e.clientY - rect.top) / height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cameraRef.current);
      const balls = [hBallRef.current, vBallRef.current, zBallRef.current].filter(Boolean) as THREE.Mesh[];
      const intersects = raycaster.intersectObjects(balls);
      setHovered(intersects.length > 0 ? intersects[0].object.userData.type : null);
      return;
    }

    // 拖拽控制 - 使用動態靈敏度
    if (dragging === 'h') {
      const sens = getSensitivity('h');
      const newRotate = (rotate + deltaX * sens + 360) % 360;
      onChange({ rotate: newRotate });
    } else if (dragging === 'orbit') {
      // 軌道模式 - 同時控制水平和垂直
      const hSens = getSensitivity('h') * 0.8;
      const vSens = getSensitivity('v');
      const newRotate = (rotate + deltaX * hSens + 360) % 360;
      const newVertical = Math.max(-30, Math.min(90, vertical - deltaY * vSens));
      onChange({ rotate: newRotate, vertical: newVertical });
    } else if (dragging === 'v') {
      const sens = getSensitivity('v');
      const newVertical = Math.max(-30, Math.min(90, vertical - deltaY * sens));
      onChange({ vertical: newVertical });
    } else if (dragging === 'z') {
      const sens = getSensitivity('z');
      const newZoom = Math.max(0, Math.min(10, zoom - deltaY * sens));
      onChange({ zoom: newZoom });
    }
  }, [dragging, rotate, vertical, zoom, width, height, onChange, getSensitivity]);

  // 滑鼠釋放
  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  // 滾輪縮放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newZoom = Math.max(0, Math.min(10, zoom - e.deltaY * 0.01));
    onChange({ zoom: newZoom });
  }, [zoom, onChange]);

  // 視角描述
  const getViewDesc = () => {
    const hAngle = rotate % 360;
    let h = '正面';
    if (hAngle >= 337.5 || hAngle < 22.5) h = '正面';
    else if (hAngle < 67.5) h = '右前';
    else if (hAngle < 112.5) h = '右側';
    else if (hAngle < 157.5) h = '右後';
    else if (hAngle < 202.5) h = '背面';
    else if (hAngle < 247.5) h = '左後';
    else if (hAngle < 292.5) h = '左側';
    else h = '左前';

    let v = '平視';
    if (vertical < -15) v = '仰視';
    else if (vertical < 15) v = '平視';
    else if (vertical < 45) v = '高角度';
    else if (vertical < 75) v = '鳥瞰';
    else v = '俯視';

    let z = '中景';
    if (zoom < 2) z = '遠景';
    else if (zoom < 4) z = '中遠景';
    else if (zoom < 6) z = '中景';
    else if (zoom < 8) z = '中近景';
    else z = '特寫';

    return `${h}視角，${v}，${z}`;
  };

  const cursor = dragging ? 'grabbing' : (hovered ? 'grab' : 'crosshair');

  return (
    <div 
      className="flex flex-col bg-[#080810] overflow-hidden select-none"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* 3D 檢視 */}
      <div
        ref={containerRef}
        style={{ width, height, cursor }}
        className="relative"
        onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e); }}
        onMouseMove={handleMouseMove}
        onWheel={handleWheel}
      >
        {/* 載入遮罩 */}
        {isRunning && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-20">
            <div className="w-6 h-6 border-2 border-cyan-400/50 border-t-cyan-400 rounded-full animate-spin"></div>
          </div>
        )}
        
        {/* 無圖片提示 */}
        {!imageUrl && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="text-center">
              <div className="text-[10px] text-zinc-600">連線圖片後</div>
              <div className="text-[10px] text-zinc-500">點選 RUN 載入</div>
            </div>
          </div>
        )}
      </div>

      {/* 底部引數 & 按鈕 */}
      <div className="flex items-center justify-between px-2 py-1 border-t border-cyan-900/30 bg-[#0a0a14]">
        <div className="flex items-center gap-2 text-[9px] font-mono">
          <span className="text-blue-400">{Math.round(rotate)}°</span>
          <span className="text-cyan-400">{Math.round(vertical)}°</span>
          <span className="text-yellow-400">{zoom.toFixed(1)}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onChange({ rotate: 0, vertical: 0, zoom: 5 })}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-5 h-5 rounded bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors"
            title="重置"
          >
            <span className="text-zinc-400 text-[10px]">↺</span>
          </button>
          {onRun && (
            <button
              onClick={(e) => { e.stopPropagation(); onRun(); }}
              onMouseDown={(e) => e.stopPropagation()}
              disabled={isRunning}
              className="px-2 h-5 rounded bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-700 text-white text-[9px] font-medium transition-colors"
            >
              RUN
            </button>
          )}
        </div>
      </div>

      {/* 視角描述 */}
      <div className="px-2 py-1 border-t border-cyan-900/20 bg-[#080810]">
        <div className="text-[9px] text-cyan-300/70 truncate">{getViewDesc()}</div>
      </div>
    </div>
  );
};

export default MultiAngle3D;
