
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { CanvasNode, Vec2, NodeType, Connection, GenerationConfig, NodeData, CanvasPreset, PresetInput } from '../../types/pebblingTypes';
import { CreativeIdea } from '../../types';
import FloatingInput from './FloatingInput';
import CanvasNodeItem from './CanvasNode';
import Sidebar from './Sidebar';
import ContextMenu from './ContextMenu';
import PresetCreationModal from './PresetCreationModal';
import PresetInstantiationModal from './PresetInstantiationModal';
import CanvasNameBadge from './CanvasNameBadge';
import { editImageWithGemini, chatWithThirdPartyApi, getThirdPartyConfig, ImageEditConfig } from '../../services/geminiService';
import * as canvasApi from '../../services/api/canvas';
import { downloadRemoteToOutput } from '../../services/api/files';
import { Icons } from './Icons';

// === 畫布用API介面卡，橋接主專案的geminiService ===

// 檢查API是否已配置（支援貞貞API或原生Gemini）
const isApiConfigured = (): boolean => {
  const config = getThirdPartyConfig();
  // 貞貞API 或 Gemini API Key
  const hasThirdParty = !!(config && config.enabled && config.apiKey);
  const hasGemini = !!localStorage.getItem('gemini_api_key');
  return hasThirdParty || hasGemini;
};

// base64 轉 File
const base64ToFile = async (base64: string, filename: string = 'image.png'): Promise<File> => {
  const response = await fetch(base64);
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type || 'image/png' });
};

// 生成圖片（文生圖/圖生圖）- 自動選擇貞貞API或Gemini
const generateCreativeImage = async (
  prompt: string, 
  config?: GenerationConfig,
  signal?: AbortSignal
): Promise<string | null> => {
  try {
    const imageConfig: ImageEditConfig = {
      aspectRatio: config?.aspectRatio || '1:1',
      imageSize: config?.resolution || '1K',
    };
    // 使用統一的 editImageWithGemini，它會自動判斷用哪個API
    const result = await editImageWithGemini([], prompt, imageConfig);
    return result.imageUrl;
  } catch (e) {
    console.error('文生圖失敗:', e);
    return null;
  }
};

// 編輯圖片（圖生圖）- 自動選擇貞貞API或Gemini
const editCreativeImage = async (
  images: string[],
  prompt: string,
  config?: GenerationConfig,
  signal?: AbortSignal
): Promise<string | null> => {
  try {
    // 轉換base64為File物件
    const files = await Promise.all(images.map((img, i) => base64ToFile(img, `input_${i}.png`)));
    const imageConfig: ImageEditConfig = {
      aspectRatio: config?.aspectRatio || 'Auto',
      imageSize: config?.resolution || '1K',
    };
    // 使用統一的 editImageWithGemini，它會自動判斷用哪個API
    const result = await editImageWithGemini(files, prompt, imageConfig);
    return result.imageUrl;
  } catch (e) {
    console.error('圖生圖失敗:', e);
    return null;
  }
};

// 生成文字/擴寫
const generateCreativeText = async (content: string): Promise<{ title: string; content: string }> => {
  try {
    const systemPrompt = `You are a creative writing assistant. Expand and enhance the following content into a more detailed and vivid description. Output ONLY the enhanced text, no titles or explanations.`;
    const result = await chatWithThirdPartyApi(systemPrompt, content);
    // 提取第一行作為標題
    const lines = result.split('\n').filter(l => l.trim());
    const title = lines[0]?.slice(0, 50) || '擴寫內容';
    return { title, content: result };
  } catch (e) {
    console.error('文字生成失敗:', e);
    return { title: '錯誤', content: String(e) };
  }
};

// LLM文書處理
const generateAdvancedLLM = async (
  userPrompt: string,
  systemPrompt?: string,
  images?: string[]
): Promise<string> => {
  try {
    const system = systemPrompt || 'You are a helpful assistant.';
    // 如果有圖片，取第一張轉換為File
    let imageFile: File | undefined;
    if (images && images.length > 0) {
      imageFile = await base64ToFile(images[0], 'input.png');
    }
    // 使用通用的chat介面（不帶圖片時傳undefined）
    const result = await chatWithThirdPartyApi(system, userPrompt, imageFile);
    return result;
  } catch (e) {
    console.error('LLM處理失敗:', e);
    return `錯誤: ${e}`;
  }
};

// 檢查是否是有效的影片資料
const isValidVideo = (content: string | undefined): boolean => {
  if (!content || content.length < 10) return false;
  return (
    content.startsWith('data:video') ||
    content.startsWith('http://') ||
    content.startsWith('https://') ||
    content.startsWith('//') ||
    content.startsWith('/files/')
  );
};

// 檢查是否是有效的圖片資料
const isValidImage = (content: string | undefined): boolean => {
  if (!content || content.length < 10) return false;
  return (
    content.startsWith('data:image') ||
    content.startsWith('http://') ||
    content.startsWith('https://') ||
    content.startsWith('//') ||
    content.startsWith('/files/') ||
    content.startsWith('/api/')
  );
};

// 🔥 提取圖片後設資料(寬高/大小/格式)
interface ImageMetadata {
  width: number;
  height: number;
  size: string; // 格式化後的大小, 如 "125 KB"
  format: string; // 圖片格式, 如 "PNG", "JPEG"
}

const extractImageMetadata = async (imageUrl: string): Promise<ImageMetadata> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      
      // 提取格式
      let format = 'UNKNOWN';
      if (imageUrl.startsWith('data:image/')) {
        const match = imageUrl.match(/data:image\/(\w+);/);
        format = match ? match[1].toUpperCase() : 'BASE64';
      } else if (imageUrl.includes('.')) {
        const ext = imageUrl.split('.').pop()?.split('?')[0];
        format = ext ? ext.toUpperCase() : 'URL';
      }
      
      // 計算大小
      let size = 'Unknown';
      if (imageUrl.startsWith('data:')) {
        // Base64: 計算字串長度
        const base64Length = imageUrl.split(',')[1]?.length || 0;
        const bytes = (base64Length * 3) / 4; // Base64解碼後的位元組數
        if (bytes < 1024) {
          size = `${Math.round(bytes)} B`;
        } else if (bytes < 1024 * 1024) {
          size = `${(bytes / 1024).toFixed(1)} KB`;
        } else {
          size = `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
        }
      }
      
      resolve({ width, height, size, format });
    };
    
    img.onerror = () => {
      console.warn('[extractImageMetadata] 圖片載入失敗:', imageUrl.slice(0, 100));
      // 返回預設值
      resolve({ width: 0, height: 0, size: 'Unknown', format: 'Unknown' });
    };
    
    img.src = imageUrl;
  });
};

// === 畫布元件開始 ===

interface PebblingCanvasProps {
  onImageGenerated?: (imageUrl: string, prompt: string, canvasId?: string, canvasName?: string) => void; // 回撥同步到桌面（含畫布ID用於聯動）
  onCanvasCreated?: (canvasId: string, canvasName: string) => void; // 畫布建立回撥（用於桌面聯動建立資料夾）
  creativeIdeas?: CreativeIdea[]; // 主專案創意庫
  isActive?: boolean; // 畫布是否處於活動狀態（用於快捷鍵作用域控制）
  pendingImageToAdd?: { imageUrl: string; imageName?: string } | null; // 待新增的圖片（從桌面新增）
  onPendingImageAdded?: () => void; // 圖片新增完成後的回撥
}

const PebblingCanvas: React.FC<PebblingCanvasProps> = ({ 
  onImageGenerated, 
  onCanvasCreated, 
  creativeIdeas = [], 
  isActive = true,
  pendingImageToAdd,
  onPendingImageAdded
}) => {
  // --- 畫布管理狀態 ---
  const [currentCanvasId, setCurrentCanvasId] = useState<string | null>(null);
  const [canvasList, setCanvasList] = useState<canvasApi.CanvasListItem[]>([]);
  const [canvasName, setCanvasName] = useState('未命名畫布');
  const [isCanvasLoading, setIsCanvasLoading] = useState(false);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveRef = useRef<{ nodes: string; connections: string }>({ nodes: '', connections: '' });
  const saveCanvasRef = useRef<(() => Promise<void>) | null>(null); // 用於避免迴圈依賴

  // --- State ---
  const [showIntro, setShowIntro] = useState(false); // 禁用解鎖動畫
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  
  // 自動儲存狀態（預設禁用，首次操作後啟用）
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  
  // 未儲存標記（用於提醒使用者）
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Refs for State (to avoid stale closures in execution logic)
  const nodesRef = useRef<CanvasNode[]>([]);
  const connectionsRef = useRef<Connection[]>([]);

  useEffect(() => {
      nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
      connectionsRef.current = connections;
  }, [connections]);
  
  // Canvas Transform
  const [canvasOffset, setCanvasOffset] = useState<Vec2>({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [dragStart, setDragStart] = useState<Vec2>({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false); // 空格鍵狀態，用於拖拽畫布

  // Node Selection & Dragging
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set<string>());
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [isDragOperation, setIsDragOperation] = useState(false); // Tracks if actual movement occurred
  
  // Refs to track dragging state for immediate save detection
  const draggingNodeIdRef = useRef<string | null>(null);
  const isDragOperationRef = useRef(false);
  
  useEffect(() => {
    draggingNodeIdRef.current = draggingNodeId;
  }, [draggingNodeId]);
  
  useEffect(() => {
    isDragOperationRef.current = isDragOperation;
  }, [isDragOperation]);
  
  // Copy/Paste Buffer
  const clipboardRef = useRef<CanvasNode[]>([]);

  // Abort Controllers for cancelling operations
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const executingNodesRef = useRef<Set<string>>(new Set()); // 正在執行的節點ID集合，用於防止重複執行

  // Dragging Mathematics (Delta based)
  const [dragStartMousePos, setDragStartMousePos] = useState<Vec2>({ x: 0, y: 0 });
  const dragStartMousePosRef = useRef<Vec2>({ x: 0, y: 0 }); // ref 備份，供實時更新
  const [initialNodePositions, setInitialNodePositions] = useState<Map<string, Vec2>>(new Map());
  const initialNodePositionsRef = useRef<Map<string, Vec2>>(new Map()); // ref 同步備份，供 RAF 使用
  
  // 拖拽最佳化：使用 ref 儲存實時偏移量，避免頻繁 setState
  const dragDeltaRef = useRef<Vec2>({ x: 0, y: 0 });
  const canvasDragRef = useRef<Vec2>({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const isCanvasDraggingRef = useRef(false);
  
  // 上次滑鼠位置，用於計算畫布平移時的增量
  const lastMousePosRef = useRef<Vec2>({ x: 0, y: 0 });
  
  // 縮放結束後的重繪定時器
  const zoomEndTimerRef = useRef<number | null>(null);
  
  // Ref to handleExecuteNode for use in callbacks (避免依賴迴圈)
  const executeNodeRef = useRef<((nodeId: string, batchCount?: number) => Promise<void>) | null>(null);
  
  // Selection Box
  const [selectionBox, setSelectionBox] = useState<{ start: Vec2, current: Vec2 } | null>(null);

  // Connection Linking
  const [linkingState, setLinkingState] = useState<{
      active: boolean;
      fromNode: string | null;
      startPos: Vec2;
      currPos: Vec2;
  }>({ active: false, fromNode: null, startPos: { x: 0, y: 0 }, currPos: { x: 0, y: 0 } });

  // Generation Global Flag (Floating Input)
  const [isGenerating, setIsGenerating] = useState(false);

  // Presets & Libraries - Load from localStorage
  const [userPresets, setUserPresets] = useState<CanvasPreset[]>(() => {
    try {
      const saved = localStorage.getItem('pebbling_user_presets');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to load presets:', e);
      return [];
    }
  });

  // Save presets to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('pebbling_user_presets', JSON.stringify(userPresets));
    } catch (e) {
      console.error('Failed to save presets:', e);
    }
  }, [userPresets]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [nodesForPreset, setNodesForPreset] = useState<CanvasNode[]>([]); // Buffer for preset creation
  
  // Preset Instantiation
  const [instantiatingPreset, setInstantiatingPreset] = useState<CanvasPreset | null>(null);

  // API Settings Modal
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [apiConfigured, setApiConfigured] = useState(false);

  // Check API configuration on mount
  useEffect(() => {
    setApiConfigured(isApiConfigured());
  }, []);

  // --- 畫布持久化邏輯 ---
  
  // 載入畫佈列表
  const loadCanvasList = useCallback(async () => {
    try {
      const result = await canvasApi.getCanvasList();
      if (result.success && result.data) {
        setCanvasList(result.data);
        return result.data;
      }
    } catch (e) {
      console.error('[Canvas] 載入列表失敗:', e);
    }
    return [];
  }, []);

  // 載入單個畫布
  const loadCanvas = useCallback(async (canvasId: string) => {
    console.log('='.repeat(60));
    console.log('[畫布切換] 開始切換到畫布:', canvasId);
    
    // 🔧 關鍵修復1：立即清除自動儲存定時器，防止在切換過程中觸發儲存
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      console.log('[畫布切換] 已清除自動儲存定時器');
    }
    
    // 🔧 關鍵修復2：先儲存當前畫布（如果有變化）
    if (currentCanvasId && currentCanvasId !== canvasId) {
      console.log('[畫布切換] 💾 當前畫布:', currentCanvasId.slice(0, 12));
      console.log('[畫布切換] 💾 nodesRef.current.length:', nodesRef.current.length);
      console.log('[畫布切換] 💾 nodesRef.current:', JSON.stringify(nodesRef.current.map(n => ({ id: n.id.slice(0, 8), type: n.type }))));
      
      // 檢查是否有變化（與 lastSaveRef 比較）
      const currentNodesStr = JSON.stringify(nodesRef.current);
      const currentConnsStr = JSON.stringify(connectionsRef.current);
      const hasChanges = currentNodesStr !== lastSaveRef.current.nodes || 
                         currentConnsStr !== lastSaveRef.current.connections;
      
      if (hasChanges || nodesRef.current.length > 0) {
        console.log('[畫布切換] ✅ 檢測到資料，強制儲存...');
        try {
          // 🔧 直接儲存，不使用 ref，避免閉包陷阱
          await canvasApi.updateCanvas(currentCanvasId, {
            nodes: nodesRef.current,
            connections: connectionsRef.current,
          });
          console.log('[畫布切換] ✅ 當前畫布已儲存');
          lastSaveRef.current = {
            nodes: currentNodesStr,
            connections: currentConnsStr
          };
          // 🆕 儲存後重新整理列表，更新節點數和修改時間
          await loadCanvasList();
        } catch (e) {
          console.error('[畫布切換] ❌ 儲存失敗:', e);
        }
      } else {
        console.log('[畫布切換] ⏭️ 當前畫布無資料，跳過儲存');
      }
    }
    
    setIsCanvasLoading(true);
    try {
      console.log('[畫布切換] 📥 開始呼叫 canvasApi.getCanvas:', canvasId.slice(0, 12));
      const result = await canvasApi.getCanvas(canvasId);
      if (result.success && result.data) {
        const loadedNodes = result.data.nodes || [];
        const loadedConnections = result.data.connections || [];
        
        console.log('[畫布切換] 📦 後端返回資料:', result.data.name);
        console.log('[畫布切換] 📦 loadedNodes.length:', loadedNodes.length);
        console.log('[畫布切換] 📦 loadedNodes:', JSON.stringify(loadedNodes.map(n => ({ id: n.id.slice(0, 8), type: n.type }))));
        
        // 🔧 關鍵修復3：先更新 currentCanvasId，再更新 nodes/connections
        // 這樣自動儲存的 useEffect 就會看到正確的 canvasId
        setCurrentCanvasId(canvasId);
        setCanvasName(result.data.name);
        
        // 🔧 關鍵：先清空 ref，再設定新值
        nodesRef.current = [];
        connectionsRef.current = [];
        console.log('[畫布切換] 🧹 已清空 nodesRef');
        
        // 然後更新 state 和 ref
        setNodes(loadedNodes);
        setConnections(loadedConnections);
        nodesRef.current = loadedNodes;
        connectionsRef.current = loadedConnections;
        
        console.log('[畫布切換] 🔄 更新後的 nodesRef.length:', nodesRef.current.length);
        console.log('[畫布切換] 🔄 更新後的 nodesRef:', JSON.stringify(nodesRef.current.map(n => ({ id: n.id.slice(0, 8), type: n.type }))));
        
        // 更新快取，防止立即觸發儲存
        lastSaveRef.current = {
          nodes: JSON.stringify(loadedNodes),
          connections: JSON.stringify(loadedConnections)
        };
        
        // 清除未儲存標記
        setHasUnsavedChanges(false);
        
        console.log('[畫布切換] ✅ 切換完成:', result.data.name);
        console.log('='.repeat(60));
        
        // 自動恢復Video節點的非同步任務
        setTimeout(() => {
          recoverVideoTasks(loadedNodes);
        }, 1000); // 延遲1秒執行，確保畫布已完全載入
      }
    } catch (e) {
      console.error('[畫布切換] ❌ 載入畫布失敗:', e);
    }
    setIsCanvasLoading(false);
  }, [currentCanvasId, loadCanvasList]);

  // 建立新畫布
  const createNewCanvas = useCallback(async (name?: string) => {
    console.log('[建立畫布] 開始建立新畫布:', name);
    
    // 🔧 關鍵修復：立即清除自動儲存定時器
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      console.log('[建立畫布] 已清除自動儲存定時器');
    }
    
    // 🔧 先儲存當前畫布（如果有變化）
    if (currentCanvasId) {
      console.log('[建立畫布] 當前畫布:', currentCanvasId, '節點數:', nodesRef.current.length);
      
      const currentNodesStr = JSON.stringify(nodesRef.current);
      const currentConnsStr = JSON.stringify(connectionsRef.current);
      const hasChanges = currentNodesStr !== lastSaveRef.current.nodes || 
                         currentConnsStr !== lastSaveRef.current.connections;
      
      if (hasChanges || nodesRef.current.length > 0) {
        console.log('[建立畫布] 檢測到資料，強制儲存...');
        try {
          // 🔧 直接儲存，不使用 ref，避免閉包陷阱
          await canvasApi.updateCanvas(currentCanvasId, {
            nodes: nodesRef.current,
            connections: connectionsRef.current,
          });
          console.log('[建立畫布] 當前畫布已儲存');
          lastSaveRef.current = {
            nodes: currentNodesStr,
            connections: currentConnsStr
          };
          // 🆕 儲存後重新整理列表，更新節點數和修改時間
          await loadCanvasList();
        } catch (e) {
          console.error('[建立畫布] 儲存失敗:', e);
        }
      } else {
        console.log('[建立畫布] 當前畫布無資料，跳過儲存');
      }
    }
    
    try {
      // 🆕 智慧命名：從“畫布 1”開始輪詢，重名則跳過
      let finalName = name;
      if (!finalName) {
        // 重新整理列表獲取最新資料
        const latestList = await loadCanvasList();
        const existingNames = new Set(latestList.map(c => c.name));
        
        // 從 1 開始輪詢，找到第一個未被使用的名字
        let index = 1;
        while (existingNames.has(`畫布 ${index}`)) {
          index++;
        }
        finalName = `畫布 ${index}`;
        console.log('[建立畫布] 智慧命名:', finalName);
      }
      
      const result = await canvasApi.createCanvas({ name: finalName });
      if (result.success && result.data) {
        setCurrentCanvasId(result.data.id);
        setCanvasName(result.data.name);
        setNodes([]);
        setConnections([]);
        nodesRef.current = [];
        connectionsRef.current = [];
        lastSaveRef.current = { nodes: '[]', connections: '[]' };
        setHasUnsavedChanges(false);
        await loadCanvasList();
        console.log('[建立畫布] 建立新畫布完成:', result.data.name);
          
        // 通知外層建立桌面資料夾
        if (onCanvasCreated) {
          onCanvasCreated(result.data.id, result.data.name);
        }
          
        return result.data;
      }
    } catch (e) {
      console.error('[建立畫布] 建立畫布失敗:', e);
    }
    return null;
  }, [loadCanvasList, onCanvasCreated, currentCanvasId]);

  // 儲存當前畫布（防抖）- 會自動將圖片內容本地化到畫布專屬資料夾
  const saveCurrentCanvas = useCallback(async () => {
    if (!currentCanvasId) return;
    
    // 獲取當前畫布名稱
    const currentCanvas = canvasList.find(c => c.id === currentCanvasId);
    const currentCanvasName = currentCanvas?.name || canvasName;
    
    // 本地化圖片內容：將base64/臨時URL轉換為本地檔案（儲存到畫布專屬資料夾）
    const localizedNodes = await Promise.all(nodesRef.current.map(async (node) => {
      // 只處理有圖片內容的節點
      if (!node.content) return node;
      
      // 檢查是否是需要本地化的內容
      const isBase64 = node.content.startsWith('data:image');
      const isTempUrl = node.content.startsWith('http') && 
                        !node.content.includes('/files/output/') && 
                        !node.content.includes('/files/input/');
      
      if (!isBase64 && !isTempUrl) {
        // 已經是本地檔案URL，無需處理
        return node;
      }
      
      try {
        let result;
        if (isBase64) {
          // Base64 -> 儲存到畫布專屬資料夾
          result = await canvasApi.saveCanvasImage(node.content, currentCanvasName, node.id, currentCanvasId);
        } else if (isTempUrl) {
          // 遠端URL -> 下載到本地
          result = await downloadRemoteToOutput(node.content, `canvas_${node.id}_${Date.now()}.png`);
        }
        
        if (result?.success && result.data?.url) {
          console.log(`[Canvas] 圖片已本地化: ${node.id.slice(0,8)} -> ${result.data.url}`);
          return { ...node, content: result.data.url };
        }
      } catch (e) {
        console.error(`[Canvas] 圖片本地化失敗:`, e);
      }
      
      return node;
    }));
    
    const nodesStr = JSON.stringify(localizedNodes);
    const connectionsStr = JSON.stringify(connectionsRef.current);
    
    // 檢查是否有變化
    if (nodesStr === lastSaveRef.current.nodes && connectionsStr === lastSaveRef.current.connections) {
      return;
    }
    
    try {
      await canvasApi.updateCanvas(currentCanvasId, {
        nodes: localizedNodes,
        connections: connectionsRef.current,
      });
      
      // 更新 ref 和 state
      nodesRef.current = localizedNodes;
      setNodes(localizedNodes);
      
      lastSaveRef.current = { nodes: nodesStr, connections: connectionsStr };
      console.log('[Canvas] 自動儲存');
      
      // 🆕 儲存後重新整理列表，更新節點數和修改時間
      await loadCanvasList();
    } catch (e) {
      console.error('[Canvas] 儲存失敗:', e);
    }
  }, [currentCanvasId, canvasList, canvasName, loadCanvasList]);

  // 將saveCurrentCanvas賦值給ref，供其他函式呼叫（避免迴圈依賴）
  useEffect(() => {
    saveCanvasRef.current = saveCurrentCanvas;
  }, [saveCurrentCanvas]);
  
  // 自動恢復Video節點的非同步任務
  const recoverVideoTasks = useCallback(async (nodesToCheck: CanvasNode[]) => {
    const videoNodes = nodesToCheck.filter(node => 
      node.type === 'video' && 
      node.status === 'running' && 
      (node.data as any)?.videoTaskId &&
      !isValidVideo(node.content)
    );
    
    if (videoNodes.length === 0) {
      console.log('[畫布恢復] 沒有檢測到未完成的Video任務');
      return;
    }
    
    console.log(`[畫布恢復] 檢測到 ${videoNodes.length} 個未完成的Video任務，開始恢復...`);
    
    // 對每個未完成的Video節點，觸發執行流程（會自動進入恢復邏輯）
    for (let i = 0; i < videoNodes.length; i++) {
      const node = videoNodes[i];
      console.log(`[畫布恢復] 恢復節點 ${node.id.slice(0, 8)}, taskId: ${(node.data as any)?.videoTaskId}`);
      // 觸發執行，handleExecuteNode 會檢測到這是恢復場景
      // 使用 executeNodeRef 來避免依賴問題
      setTimeout(() => {
        if (executeNodeRef.current) {
          executeNodeRef.current(node.id);
        }
      }, i * 500); // 每個節點間隔500ms，避免同時觸發多個請求
    }
  }, []);

  // 刪除畫布
  const deleteCanvasById = useCallback(async (canvasId: string) => {
    try {
      console.log('[刪除畫布] 開始刪除:', canvasId.slice(0, 12));
      
      // 🆕 先獲取當前列表，確定刪除後要切換到哪個畫布
      const currentList = canvasList.length > 0 ? canvasList : await loadCanvasList();
      const deleteIndex = currentList.findIndex(c => c.id === canvasId);
      const isDeletingCurrent = canvasId === currentCanvasId;
      
      console.log('[刪除畫布] 當前列表長度:', currentList.length);
      console.log('[刪除畫布] 刪除索引:', deleteIndex);
      console.log('[刪除畫布] 是否刪除當前畫布:', isDeletingCurrent);
      
      const result = await canvasApi.deleteCanvas(canvasId);
      if (result.success) {
        console.log('[刪除畫布] ✅ 後端刪除成功');
        
        // 重新整理列表
        const updatedList = await loadCanvasList();
        console.log('[刪除畫布] 刪除後列表長度:', updatedList.length);
        
        // 🆕 如果刪除的是當前畫布，需要自動切換
        if (isDeletingCurrent) {
          if (updatedList.length === 0) {
            // 沒有畫布了，建立新畫布
            console.log('[刪除畫布] 沒有畫布了，建立新畫布');
            await createNewCanvas();
          } else {
            // 🆕 有其他畫布，切換到下一個（或上一個）
            let nextCanvas;
            if (deleteIndex < updatedList.length) {
              // 切換到同一位置的下一個畫布
              nextCanvas = updatedList[deleteIndex];
              console.log('[刪除畫布] 切換到下一個畫布:', nextCanvas.name);
            } else {
              // 刪除的是最後一個，切換到倒數第二個
              nextCanvas = updatedList[updatedList.length - 1];
              console.log('[刪除畫布] 刪除最後一個，切換到:', nextCanvas.name);
            }
            await loadCanvas(nextCanvas.id);
          }
        }
        
        console.log('[刪除畫布] ✅ 刪除完成');
      }
    } catch (e) {
      console.error('[刪除畫布] ❌ 刪除失敗:', e);
    }
  }, [currentCanvasId, canvasList, loadCanvasList, createNewCanvas, loadCanvas]);

  // 重新命名畫布（同步重新命名資料夾）
  const renameCanvas = useCallback(async (newName: string) => {
    if (!currentCanvasId || !newName.trim()) return;
    
    try {
      const result = await canvasApi.updateCanvas(currentCanvasId, { name: newName.trim() });
      if (result.success) {
        setCanvasName(newName.trim());
        await loadCanvasList();
        console.log('[Canvas] 畫布已重新命名:', newName);
      }
    } catch (e) {
      console.error('[Canvas] 重新命名失敗:', e);
    }
  }, [currentCanvasId, loadCanvasList]);

  // 初始化：載入最近畫布或建立新畫布
  useEffect(() => {
    const initCanvas = async () => {
      const list = await loadCanvasList();
      if (list.length > 0) {
        // 載入最近更新的畫布
        const sorted = [...list].sort((a, b) => b.updatedAt - a.updatedAt);
        await loadCanvas(sorted[0].id);
      } else {
        // 建立第一個畫布
        await createNewCanvas('畫布 1');
      }
      
      // 畫布初始化完成後，處理待新增的圖片
      canvasInitializedRef.current = true;
      setTimeout(() => {
        processPendingImage();
      }, 200);
    };
    initCanvas();
  }, []); // 只在元件掛載時執行一次

  // 自動儲存（防拖2000ms，避免拖拽時頻繁觸發）
  useEffect(() => {
    if (!currentCanvasId) return;
      
    // 如果自動儲存被禁用，跳過
    if (!autoSaveEnabled) {
      console.log('[自動儲存] 已禁用，跳過');
      return;
    }
      
    // 如果正在拖拽節點，跳過自動儲存
    if (draggingNodeId || isDragOperation) {
      console.log('[自動儲存] 拖拽中，跳過');
      return;
    }
      
    // 🔧 關鍵修復：檢查當前 nodes/connections 是否與 lastSaveRef 一致
    // 如果一致，說明是剛載入的資料，不需要儲存
    const currentNodesStr = JSON.stringify(nodes);
    const currentConnsStr = JSON.stringify(connections);
    if (currentNodesStr === lastSaveRef.current.nodes && 
        currentConnsStr === lastSaveRef.current.connections) {
      console.log('[自動儲存] 資料未變化，跳過');
      return;
    }
      
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
      
    saveTimerRef.current = setTimeout(() => {
      saveCurrentCanvas();
    }, 2000); // 增加防拖時間到2秒
      
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [nodes, connections, currentCanvasId, saveCurrentCanvas, draggingNodeId, isDragOperation, autoSaveEnabled]);


  // Re-check API config when settings modal closes
  const handleCloseApiSettings = () => {
    setShowApiSettings(false);
    setApiConfigured(isApiConfigured());
  };

  const containerRef = useRef<HTMLDivElement>(null);

  // --- Utils ---
  const uuid = () => Math.random().toString(36).substr(2, 9);

  // Helper for Client-Side Resize
  const resizeImageClient = (base64Str: string, mode: 'longest' | 'shortest' | 'width' | 'height' | 'exact', widthVal: number, heightVal: number): Promise<string> => {
      return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
              let currentW = img.width;
              let currentH = img.height;
              let newWidth = currentW;
              let newHeight = currentH;
              const aspectRatio = currentW / currentH;

              if (mode === 'exact') {
                  newWidth = widthVal;
                  newHeight = heightVal;
              } else if (mode === 'width') {
                  newWidth = widthVal;
                  newHeight = widthVal / aspectRatio;
              } else if (mode === 'height') {
                  newHeight = heightVal;
                  newWidth = heightVal * aspectRatio;
              } else if (mode === 'longest') {
                  const target = widthVal; // Use widthVal as the primary 'target' container
                  if (currentW > currentH) {
                      newWidth = target;
                      newHeight = target / aspectRatio;
                  } else {
                      newHeight = target;
                      newWidth = target * aspectRatio;
                  }
              } else if (mode === 'shortest') {
                  const target = widthVal; // Use widthVal as the primary 'target' container
                  if (currentW < currentH) {
                      newWidth = target;
                      newHeight = target / aspectRatio;
                  } else {
                      newHeight = target;
                      newWidth = target * aspectRatio;
                  }
              }

              const canvas = document.createElement('canvas');
              canvas.width = newWidth;
              canvas.height = newHeight;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                  // High quality scaling
                  ctx.imageSmoothingEnabled = true;
                  ctx.imageSmoothingQuality = 'high';
                  ctx.drawImage(img, 0, 0, newWidth, newHeight);
                  resolve(canvas.toDataURL(base64Str.startsWith('data:image/png') ? 'image/png' : 'image/jpeg', 0.92));
              } else {
                  reject("Canvas context error");
              }
          };
          img.onerror = reject;
          img.src = base64Str;
      });
  };

  // --- Color Logic ---
  const resolveEffectiveType = useCallback((nodeId: string, visited: Set<string> = new Set()): string => {
      if (visited.has(nodeId)) return 'default';
      visited.add(nodeId);
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return 'default';
      if (node.type !== 'relay') return node.type;
      const inputConnection = connections.find(c => c.toNode === nodeId);
      if (inputConnection) return resolveEffectiveType(inputConnection.fromNode, visited);
      return 'default';
  }, [nodes, connections]);

  const getLinkColor = (effectiveType: string, isSelected: boolean) => {
      if (isSelected) return '#f97316'; // Orange for selected
      switch (effectiveType) {
          case 'image': case 'edit': case 'remove-bg': case 'upscale': case 'resize': return '#3b82f6';
          case 'llm': return '#a855f7'; // Purple for LLM/Logic
          case 'text': case 'idea': return '#10b981'; // Emerald for Text/Idea
          case 'video': return '#eab308';
          default: return '#71717a';
      }
  };

  // --- Actions ---

  // 啟用自動儲存（首次操作時觸發）
  const enableAutoSave = useCallback(() => {
    if (!autoSaveEnabled) {
      setAutoSaveEnabled(true);
      console.log('[自動儲存] 已啟用');
    }
  }, [autoSaveEnabled]);

  // 手動儲存
  const handleManualSave = useCallback(async () => {
    console.log('[手動儲存] 開始儲存...');
    await saveCurrentCanvas();
    // 儲存後清除未儲存標記
    setHasUnsavedChanges(false);
    console.log('[手動儲存] 儲存完成');
  }, [saveCurrentCanvas]);

  const handleResetView = () => {
    setCanvasOffset({ x: 0, y: 0 });
    setScale(1);
  };

  const deleteSelection = useCallback(() => {
      // 1. Delete Nodes
      if (selectedNodeIds.size > 0) {
          const idsToDelete = new Set<string>(selectedNodeIds);
          setNodes(prev => prev.filter(n => !idsToDelete.has(n.id)));
          setConnections(prev => prev.filter(c => !idsToDelete.has(c.fromNode) && !idsToDelete.has(c.toNode)));
          setSelectedNodeIds(new Set<string>());
          setHasUnsavedChanges(true); // 標記未儲存
      }
      // 2. Delete Connection
      if (selectedConnectionId) {
          setConnections(prev => prev.filter(c => c.id !== selectedConnectionId));
          setSelectedConnectionId(null);
          setHasUnsavedChanges(true); // 標記未儲存
      }
  }, [selectedNodeIds, selectedConnectionId]);

  const handleCopy = useCallback(() => {
      if (selectedNodeIds.size === 0) return;
      const nodesToCopy = nodesRef.current.filter(n => selectedNodeIds.has(n.id));
      // Store deep copy
      clipboardRef.current = JSON.parse(JSON.stringify(nodesToCopy));
  }, [selectedNodeIds]);

  const handlePaste = useCallback(() => {
      if (clipboardRef.current.length === 0) return;
      
      const newNodes: CanvasNode[] = [];
      const idMap = new Map<string, string>(); // Old ID -> New ID

      // Create new nodes
      clipboardRef.current.forEach(node => {
          const newId = uuid();
          idMap.set(node.id, newId);
          newNodes.push({
              ...node,
              id: newId,
              x: node.x + 50, // Offset
              y: node.y + 50,
              status: 'idle' // Reset status
          });
      });

      setNodes(prev => [...prev, ...newNodes]);
      setSelectedNodeIds(new Set(newNodes.map(n => n.id)));
      setHasUnsavedChanges(true); // 標記未儲存
  }, []);

  // Global Key Listener - 只在畫布活動時生效
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          // 空格鍵跟蹤（僅在畫布活動時）
          if (isActive && e.code === 'Space' && !e.repeat) {
              const tag = document.activeElement?.tagName.toLowerCase();
              if (tag !== 'input' && tag !== 'textarea') {
                  setIsSpacePressed(true);
                  // 記錄按下空格時的滑鼠位置
                  lastMousePosRef.current = { x: 0, y: 0 }; // 將在下次 mousemove 更新
              }
          }
          
          // 如果畫布不活動，不響應任何快捷鍵
          if (!isActive) return;
          
          // 其他快捷鍵只在畫布生效
          const tag = document.activeElement?.tagName.toLowerCase();
          if (tag === 'input' || tag === 'textarea') return;

          if (e.key === 'Delete' || e.key === 'Backspace') {
              e.preventDefault();
              deleteSelection();
          }

          if (e.ctrlKey || e.metaKey) {
              if (e.key === 'c') {
                  e.preventDefault();
                  handleCopy();
              }
              if (e.key === 'v') {
                  e.preventDefault();
                  handlePaste();
              }
              if (e.key === 'a') {
                  // Ctrl+A 選中所有節點
                  e.preventDefault();
                  setSelectedNodeIds(new Set(nodesRef.current.map(n => n.id)));
              }
          }
      };
      
      const handleKeyUp = (e: KeyboardEvent) => {
          if (e.code === 'Space') {
              setIsSpacePressed(false);
          }
      };
      
      // 監聽自定義的 sidebar-drag-end 事件（滑鼠模擬拖拽）
      const handleSidebarDragEnd = (e: Event) => {
          const detail = (e as CustomEvent).detail;
          console.log('[Canvas] sidebar-drag-end received:', detail);
          
          const container = containerRef.current;
          if (!container) return;
          
          const rect = container.getBoundingClientRect();
          const x = (detail.x - rect.left - canvasOffset.x) / scale - 150;
          const y = (detail.y - rect.top - canvasOffset.y) / scale - 100;
          
          if (detail.type && ['image', 'text', 'video', 'llm', 'idea', 'relay', 'edit', 'remove-bg', 'upscale', 'resize', 'bp'].includes(detail.type)) {
              console.log('[Canvas] 建立節點:', detail.type, '位置:', x, y);
              addNode(detail.type, '', { x, y });
          }
      };
      
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      window.addEventListener('sidebar-drag-end', handleSidebarDragEnd);
      
      return () => {
          window.removeEventListener('keydown', handleKeyDown);
          window.removeEventListener('keyup', handleKeyUp);
          window.removeEventListener('sidebar-drag-end', handleSidebarDragEnd);
      };
  }, [deleteSelection, handleCopy, handlePaste, canvasOffset, scale, isActive]);

  // Wheel event handler for zooming
  const onWheel = useCallback((e: WheelEvent) => {
      // Wheel = Zoom centered on cursor
      e.preventDefault(); 

      // 使用更平滑的縮放靈敏度
      const zoomSensitivity = 0.002;
      const rawDelta = -e.deltaY * zoomSensitivity;
      
      // 限制單次縮放幅度，避免跳躍
      const delta = Math.max(-0.15, Math.min(0.15, rawDelta));
      const newScale = Math.min(Math.max(0.1, scale * (1 + delta)), 5);

      // Calculate Zoom towards Mouse Position
      const container = containerRef.current;
      if (!container) {
          setScale(newScale);
          return;
      }
      
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Math: NewOffset = Mouse - ((Mouse - OldOffset) / OldScale) * NewScale
      const newOffsetX = mouseX - ((mouseX - canvasOffset.x) / scale) * newScale;
      const newOffsetY = mouseY - ((mouseY - canvasOffset.y) / scale) * newScale;

      // 使用 RAF 確保平滑更新
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
          setScale(newScale);
          setCanvasOffset({ x: newOffsetX, y: newOffsetY });
      });
      
      // 縮放結束後的處理已移除（優先保證流暢性）
  }, [scale, canvasOffset]);

  // 新增原生 wheel 事件監聽器（非被動模式）
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    container.addEventListener('wheel', onWheel as any, { passive: false });
    
    return () => {
      container.removeEventListener('wheel', onWheel as any);
    };
  }, [onWheel]);

  const addNode = (type: NodeType, content: string = '', position?: Vec2, title?: string, data?: NodeData) => {
      const container = containerRef.current;
      let x, y;

      // 節點尺寸預計算
      let width = 300; let height = 200;
      if (type === 'image') { 
          width = 300; 
          height = 300; 
          if (data?.settings?.aspectRatio && data.settings.aspectRatio !== 'AUTO') {
              const [w, h] = data.settings.aspectRatio.split(':').map(Number);
              if (w && h) {
                  height = (width * h) / w;
              }
          }
      }
      if (type === 'video') { width = 400; height = 225; }
      if (type === 'relay') { width = 40; height = 40; }
      if (['edit', 'remove-bg', 'upscale', 'llm', 'resize'].includes(type)) { width = 280; height = 250; }
      if (type === 'llm') { width = 320; height = 300; }

      if (position) {
          x = position.x;
          y = position.y;
      } else {
          // 計算當前視野範圍（畫布座標系）
          const viewWidth = container ? container.clientWidth : window.innerWidth;
          const viewHeight = container ? container.clientHeight : window.innerHeight;
          
          // 視野在畫布座標系中的範圍
          const viewLeft = -canvasOffset.x / scale;
          const viewTop = -canvasOffset.y / scale;
          const viewRight = viewLeft + viewWidth / scale;
          const viewBottom = viewTop + viewHeight / scale;
          
          // 視野中心
          const viewCenterX = (viewLeft + viewRight) / 2;
          const viewCenterY = (viewTop + viewBottom) / 2;
          
          const currentNodes = nodesRef.current.length > 0 ? nodesRef.current : nodes;
          
          // 檢查位置是否與現有節點重疊
          const isOverlapping = (px: number, py: number, pw: number, ph: number) => {
              return currentNodes.some(n => {
                  const margin = 20;
                  return !(px + pw + margin < n.x || px > n.x + n.width + margin ||
                           py + ph + margin < n.y || py > n.y + n.height + margin);
              });
          };
          
          // 在視野內尋找空白位置（從中心開始螺旋向外搜尋）
          const findEmptySpot = (): { x: number, y: number } => {
              // 先嚐試視野中心
              let testX = viewCenterX - width / 2;
              let testY = viewCenterY - height / 2;
              
              if (!isOverlapping(testX, testY, width, height)) {
                  return { x: testX, y: testY };
              }
              
              // 螺旋搜尋空白位置
              const step = 80;
              for (let radius = 1; radius <= 20; radius++) {
                  for (let angle = 0; angle < 360; angle += 30) {
                      const rad = (angle * Math.PI) / 180;
                      testX = viewCenterX + Math.cos(rad) * radius * step - width / 2;
                      testY = viewCenterY + Math.sin(rad) * radius * step - height / 2;
                      
                      // 確保在視野內
                      if (testX >= viewLeft && testX + width <= viewRight &&
                          testY >= viewTop && testY + height <= viewBottom) {
                          if (!isOverlapping(testX, testY, width, height)) {
                              return { x: testX, y: testY };
                          }
                      }
                  }
              }
              
              // 找不到空白位置，放在視野右側
              return { x: viewRight - width - 50, y: viewCenterY - height / 2 };
          };
          
          const spot = findEmptySpot();
          x = spot.x;
          y = spot.y;
      }

      const newNode: CanvasNode = {
          id: uuid(),
          type,
          content,
          x,
          y,
          width,
          height,
          title,
          data: data || {},
          status: 'idle'
      };
      setNodes(prev => [...prev, newNode]);
      setHasUnsavedChanges(true); // 標記未儲存
      
      return newNode;
  };

  // 處理從桌面新增圖片到畫布 - 使用 ref 避免閉包問題
  const pendingImageRef = useRef<{ imageUrl: string; imageName?: string } | null>(null);
  const canvasInitializedRef = useRef(false); // 標記畫布是否已初始化
  
  useEffect(() => {
    pendingImageRef.current = pendingImageToAdd || null;
    
    // 如果畫布已初始化且有待新增的圖片，直接處理
    if (canvasInitializedRef.current && pendingImageToAdd) {
      setTimeout(() => {
        processPendingImage();
      }, 100);
    }
  }, [pendingImageToAdd]);
  
  // 處理待新增的圖片（在畫布初始化完成後呼叫）
  const processPendingImage = useCallback(() => {
    const pending = pendingImageRef.current;
    if (!pending) return;
    
    console.log('[Canvas] 處理待新增的圖片:', pending.imageName);
    
    // 新增圖片節點
    addNode('image', pending.imageUrl, undefined, pending.imageName);
    
    // 通知父元件圖片已新增
    onPendingImageAdded?.();
    pendingImageRef.current = null;
  }, [onPendingImageAdded]);

  const updateNode = (id: string, updates: Partial<CanvasNode>) => {
      // 先同步更新 ref，確保級聯執行時能立即獲取最新狀態
      const newNodes = nodesRef.current.map(n => n.id === id ? { ...n, ...updates } : n);
      nodesRef.current = newNodes;
      // 再更新 React 狀態
      setNodes(newNodes);
  };

  // --- EXECUTION LOGIC ---

  // Helper: 檢查是否是有效圖片
  const isValidImage = (content: string | undefined): boolean => {
      if (!content) return false;
      return (
          content.startsWith('data:image') || 
          content.startsWith('http://') || 
          content.startsWith('https://') ||
          content.startsWith('//') ||
          content.startsWith('/files/') ||
          content.startsWith('/api/')
      );
  };
  
  // Helper: 下載影片並儲存（透過後端代理，繞過CORS，節省瀏覽器記憶體）
  const downloadAndSaveVideo = async (videoUrl: string, nodeId: string, signal: AbortSignal) => {
      console.log('[Video節點] 影片生成成功, 開始後端代理下載:', videoUrl);
      
      try {
          // 透過後端代理下載影片（繞過CORS，節省瀏覽器記憶體）
          const response = await fetch('/api/files/download-remote-video', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ videoUrl })
          });
          
          if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(errorData.error || `後端下載失敗: ${response.status}`);
          }
          
          const result = await response.json();
          
          if (!result.success || !result.data?.url) {
              throw new Error(result.error || '後端返回資料異常');
          }
          
          // 檢查是否被中斷
          if (signal.aborted) {
              console.log('[Video節點] 下載後檢測到中斷');
              return;
          }
          
          const localVideoUrl = result.data.url; // 本地檔案路徑，如 /files/output/video_xxx.mp4
          console.log('[Video節點] 影片已儲存到本地:', result.data.filename);
          
          // 更新節點內容為本地URL（不是base64，節省記憶體）
          updateNode(nodeId, { 
              content: localVideoUrl, 
              status: 'completed',
              data: { ...nodesRef.current.find(n => n.id === nodeId)?.data, videoTaskId: undefined }
          });
          
          // 儲存畫布
          saveCurrentCanvas();
          
          console.log('[Video節點] 影片處理完成');
      } catch (downloadErr) {
          console.error('[Video節點] 後端代理下載失敗:', downloadErr);
          if (!signal.aborted) {
              // 失敗時保留原始URL，方便使用者手動下載
              updateNode(nodeId, { 
                  status: 'error',
                  data: { 
                      ...nodesRef.current.find(n => n.id === nodeId)?.data, 
                      videoTaskId: undefined,
                      videoFailReason: `下載失敗: ${downloadErr instanceof Error ? downloadErr.message : String(downloadErr)}`,
                      videoUrl: videoUrl // 保留原始URL
                  }
              });
              saveCurrentCanvas();
          }
      }
  };

  // Helper: Recursive Input Resolution - 向上追溯獲取輸入
  // 就近原則：收集沿途的文字，一旦找到圖片就停止這條路徑的回溯
  // 例如：圖1→文1→圖2→文2→圖3(RUN) → 結果: images=[圖2], texts=[文2]
  const resolveInputs = (nodeId: string, visited = new Set<string>()): { images: string[], texts: string[] } => {
      if (visited.has(nodeId)) return { images: [], texts: [] };
      visited.add(nodeId);

      // Find connections pointing to this node
      const inputConnections = connectionsRef.current.filter(c => c.toNode === nodeId);
      // Find the nodes
      const inputNodes = inputConnections
          .map(c => nodesRef.current.find(n => n.id === c.fromNode))
          .filter((n): n is CanvasNode => !!n);
      
      // Sort by Y for deterministic order
      inputNodes.sort((a, b) => a.y - b.y);

      let images: string[] = [];
      let texts: string[] = [];

      for (const node of inputNodes) {
          let foundImageInThisPath = false;
          
          // 根據節點型別收集輸出
          if (node.type === 'image') {
              // 檢查這個 Image 節點是否有上游連線（判斷是否為容器節點）
              const hasUpstream = connectionsRef.current.some(c => c.toNode === node.id);
              
              console.log(`[resolveInputs] Image節點 ${node.id.slice(0,8)}:`, {
                  hasUpstream,
                  status: node.status,
                  hasContent: isValidImage(node.content),
                  contentPreview: node.content?.slice(0, 50)
              });
              
              // 如果是容器節點（有上游），必須 status === 'completed' 才能使用其 content
              // 如果是源節點（無上游，使用者上傳的圖片），直接使用 content
              if (hasUpstream) {
                  // 容器節點：必須已完成才能使用
                  if (node.status === 'completed' && isValidImage(node.content)) {
                      console.log(`[resolveInputs] ✅ 容器節點已完成，收集圖片`);
                      images.push(node.content);
                      foundImageInThisPath = true;
                  } else {
                      console.log(`[resolveInputs] ⚠️ 容器節點未完成或無圖片，繼續向上追溯`);
                  }
              } else {
                  // 源節點：直接使用（使用者上傳的圖片）
                  if (isValidImage(node.content)) {
                      console.log(`[resolveInputs] ✅ 源節點有圖片，收集`);
                      images.push(node.content);
                      foundImageInThisPath = true;
                  }
              }
          } else if (node.type === 'text' || node.type === 'idea') {
              if (node.content) {
                  texts.push(node.content);
              }
              // 文位元組點不停止，繼續往上找圖片
          } else if (node.type === 'llm') {
              if (node.data?.output && node.status === 'completed') {
                  texts.push(node.data.output);
              }
              // LLM節點不停止，繼續往上找圖片
          } else if (node.type === 'edit') {
              if (node.data?.output && node.status === 'completed' && isValidImage(node.data.output)) {
                  images.push(node.data.output);
                  foundImageInThisPath = true; // 找到圖片，這條路徑停止
              }
          } else if (node.type === 'remove-bg' || node.type === 'upscale' || node.type === 'resize') {
              // 🔧 修復：這些工具節點不再儲存content，結果在下游的Image節點
              // 工具節點不提供圖片輸出，直接跳過
          } else if (node.type === 'bp') {
              // BP節點：優先從 data.output 獲取（有下游連線時），否則從 content 獲取
              const bpOutput = node.data?.output;
              if (node.status === 'completed') {
                  if (bpOutput && isValidImage(bpOutput)) {
                      images.push(bpOutput);
                      foundImageInThisPath = true;
                  } else if (isValidImage(node.content)) {
                      images.push(node.content);
                      foundImageInThisPath = true;
                  }
              }
          }
          // relay 節點沒有自身輸出，繼續傳遞

          // 就近原則：只有當這條路徑還沒找到圖片時，才繼續向上追溯
          if (!foundImageInThisPath) {
              const child = resolveInputs(node.id, new Set(visited));
              images.push(...child.images);
              texts.push(...child.texts);
          }
      }
      return { images, texts };
  };

  // --- 批次生成：建立多個結果節點並併發執行 ---
  const handleBatchExecute = async (sourceNodeId: string, sourceNode: CanvasNode, count: number) => {
      // 立即標記源節點為 running，防止重複點選
      updateNode(sourceNodeId, { status: 'running' });
      
      console.log(`[批次生成] 開始生成 ${count} 個結果節點`);
      // 🔍 除錯：檢視源節點的設定
      console.log('[批次生成] 源節點資訊:', {
          nodeId: sourceNodeId.slice(0, 8),
          nodeType: sourceNode.type,
          nodeData: sourceNode.data,
          settings: sourceNode.data?.settings,
          aspectRatio: sourceNode.data?.settings?.aspectRatio,
          resolution: sourceNode.data?.settings?.resolution
      });
      
      // 獲取源節點的位置和輸入
      const inputs = resolveInputs(sourceNodeId);
      const nodePrompt = sourceNode.data?.prompt || '';
      const inputTexts = inputs.texts.join('\n');
      const combinedPrompt = nodePrompt || inputTexts;
      const inputImages = inputs.images;
      
      // 獲取源節點自身的圖片
      let imageSource: string[] = [];
      if (inputImages.length > 0) {
          imageSource = inputImages;
      } else if (isValidImage(sourceNode.content)) {
          imageSource = [sourceNode.content];
      }
      
      // 檢查是否可以執行
      const hasPrompt = !!combinedPrompt;
      const hasImage = imageSource.length > 0;
      
      if (!hasPrompt && !hasImage) {
          console.warn('[批次生成] 無提示詞且無圖片，無法執行');
          updateNode(sourceNodeId, { status: 'idle' }); // 恢復狀態
          return;
      }
      
      // 建立結果節點，並自動連線到源節點
      const resultNodeIds: string[] = [];
      const newNodes: CanvasNode[] = [];
      const newConnections: Connection[] = [];
      
      // 計算結果節點的位置（源節點右側，垂直排列）
      const baseX = sourceNode.x + sourceNode.width + 150; // 距離源節點150px
      const nodeHeight = 300; // 預估節點高度
      const gap = 20; // 節點間距
      const totalHeight = count * nodeHeight + (count - 1) * gap;
      const startY = sourceNode.y + (sourceNode.height / 2) - (totalHeight / 2);
      
      for (let i = 0; i < count; i++) {
          const newId = uuid();
          resultNodeIds.push(newId);
          
          const resultNode: CanvasNode = {
              id: newId,
              type: 'image',
              title: `結果 ${i + 1}`,
              content: '',
              x: baseX,
              y: startY + i * (nodeHeight + gap),
              width: 280,
              height: nodeHeight,
              status: 'running', // 建立時就設為running
              data: {
                  prompt: combinedPrompt, // 繼承提示詞
                  settings: sourceNode.data?.settings // 繼承設定
              }
          };
          newNodes.push(resultNode);
          
          // 建立連線：源節點 -> 結果節點
          newConnections.push({
              id: uuid(),
              fromNode: sourceNodeId,
              toNode: newId
          });
      }
      
      // 新增節點和連線
      setNodes(prev => [...prev, ...newNodes]);
      setConnections(prev => [...prev, ...newConnections]);
      
      // 更新ref
      nodesRef.current = [...nodesRef.current, ...newNodes];
      connectionsRef.current = [...connectionsRef.current, ...newConnections];
      
      console.log(`[批次生成] 已建立 ${count} 個結果節點，開始併發執行`);
      
      // 併發執行所有結果節點的生成
      const execPromises = resultNodeIds.map(async (nodeId, index) => {
          const abortController = new AbortController();
          abortControllersRef.current.set(nodeId, abortController);
          const signal = abortController.signal;
          
          try {
              let result: string | null = null;
              
              // 🔧 修復：正確讀取源節點的設定
              const aspectRatio = sourceNode.data?.settings?.aspectRatio || 'AUTO';
              const resolution = sourceNode.data?.settings?.resolution || '1K';
              
              if (hasPrompt && !hasImage) {
                  // 文生圖
                  const imgConfig = aspectRatio !== 'AUTO' 
                      ? { aspectRatio, resolution }
                      : { aspectRatio: '1:1', resolution };
                  result = await generateCreativeImage(combinedPrompt, imgConfig, signal);
              } else if (hasPrompt && hasImage) {
                  // 圖生圖：正確傳遞設定引數
                  let config: GenerationConfig | undefined = undefined;
                  if (aspectRatio === 'AUTO') {
                      // AUTO 模式：只傳 resolution（如果不是預設值）
                      if (resolution !== 'AUTO' && resolution !== '1K') {
                          config = { resolution };
                      }
                  } else {
                      // 使用者指定了比例
                      config = { aspectRatio, resolution: resolution !== 'AUTO' ? resolution : '1K' };
                  }
                  console.log('[批次生成] 圖生圖配置:', { aspectRatio, resolution, config });
                  result = await editCreativeImage(imageSource, combinedPrompt, config, signal);
              } else if (!hasPrompt && hasImage) {
                  // 傳遞圖片（容器模式）
                  result = imageSource[0];
              }
              
              if (!signal.aborted) {
                  updateNode(nodeId, { 
                      content: result || '', 
                      status: result ? 'completed' : 'error' 
                  });
                  
                  // 同步到桌面
                  if (result && onImageGenerated) {
                      onImageGenerated(result, combinedPrompt, currentCanvasId || undefined, canvasName);
                  }
                  
                  console.log(`[批次生成] 結果 ${index + 1} 完成`);
              }
          } catch (err) {
              if (!signal.aborted) {
                  updateNode(nodeId, { status: 'error' });
                  console.error(`[批次生成] 結果 ${index + 1} 失敗:`, err);
              }
          } finally {
              abortControllersRef.current.delete(nodeId);
          }
      });
      
      // 等待所有執行完成
      await Promise.all(execPromises);
      
      // 標記源節點為完成
      updateNode(sourceNodeId, { status: 'completed' });
      
      // 儲存畫布
      saveCurrentCanvas();
      console.log(`[批次生成] 全部完成`);
  };

  // --- BP/Idea節點批次執行：自動建立影象節點並生成 ---
  const handleBpIdeaBatchExecute = async (sourceNodeId: string, sourceNode: CanvasNode, count: number) => {
      // 立即標記源節點為 running，防止重複點選
      updateNode(sourceNodeId, { status: 'running' });
      
      console.log(`[BP/Idea批次] 開始生成 ${count} 個影象節點`);
      
      // 獲取輸入
      const inputs = resolveInputs(sourceNodeId);
      const inputImages = inputs.images;
      
      // 獲取提示詞和設定
      let finalPrompt = '';
      let settings: any = {};
      
      if (sourceNode.type === 'bp') {
          // BP節點：處理Agent和模板
          const bpTemplate = sourceNode.data?.bpTemplate;
          const bpInputs = sourceNode.data?.bpInputs || {};
          settings = sourceNode.data?.settings || {};
          
          if (!bpTemplate) {
              console.error('[BP/Idea批次] BP節點無模板配置');
              updateNode(sourceNodeId, { status: 'idle' }); // 恢復狀態
              return;
          }
          
          const bpFields = bpTemplate.bpFields || [];
          const inputFields = bpFields.filter((f: any) => f.type === 'input');
          const agentFields = bpFields.filter((f: any) => f.type === 'agent');
          
          // 收集使用者輸入值
          const userInputValues: Record<string, string> = {};
          for (const field of inputFields) {
              userInputValues[field.name] = bpInputs[field.id] || bpInputs[field.name] || '';
          }
          
          // 執行Agent
          const agentResults: Record<string, string> = {};
          for (const field of agentFields) {
              if (field.agentConfig) {
                  let instruction = field.agentConfig.instruction;
                  for (const [name, value] of Object.entries(userInputValues)) {
                      instruction = instruction.split(`/${name}`).join(value);
                  }
                  for (const [name, result] of Object.entries(agentResults)) {
                      instruction = instruction.split(`{${name}}`).join(result);
                  }
                  
                  try {
                      const agentResult = await generateAdvancedLLM(
                          instruction,
                          'You are a creative assistant. Generate content based on the given instruction. Output ONLY the requested content, no explanations.',
                          inputImages.length > 0 ? [inputImages[0]] : undefined
                      );
                      agentResults[field.name] = agentResult;
                  } catch (agentErr) {
                      agentResults[field.name] = `[Agent錯誤: ${agentErr}]`;
                  }
              }
          }
          
          // 替換模板變數
          finalPrompt = bpTemplate.prompt;
          for (const [name, value] of Object.entries(userInputValues)) {
              finalPrompt = finalPrompt.split(`/${name}`).join(value);
          }
          for (const [name, result] of Object.entries(agentResults)) {
              finalPrompt = finalPrompt.split(`{${name}}`).join(result);
          }
      } else if (sourceNode.type === 'idea') {
          // Idea節點：直接使用content作為提示詞
          finalPrompt = sourceNode.content || '';
          settings = sourceNode.data?.settings || {};
      }
      
      if (!finalPrompt) {
          console.error('[BP/Idea批次] 無提示詞');
          updateNode(sourceNodeId, { status: 'idle' }); // 恢復狀態
          return;
      }
      
      console.log(`[BP/Idea批次] 最終提示詞:`, finalPrompt.slice(0, 100));
      
      // 建立結果節點
      const resultNodeIds: string[] = [];
      const newNodes: CanvasNode[] = [];
      const newConnections: Connection[] = [];
      
      const baseX = sourceNode.x + sourceNode.width + 150;
      const nodeHeight = 300;
      const gap = 20;
      const totalHeight = count * nodeHeight + (count - 1) * gap;
      const startY = sourceNode.y + (sourceNode.height / 2) - (totalHeight / 2);
      
      for (let i = 0; i < count; i++) {
          const newId = uuid();
          resultNodeIds.push(newId);
          
          const resultNode: CanvasNode = {
              id: newId,
              type: 'image',
              title: `結果 ${i + 1}`,
              content: '',
              x: baseX,
              y: startY + i * (nodeHeight + gap),
              width: 280,
              height: nodeHeight,
              status: 'running',
              data: {
                  prompt: finalPrompt,
                  settings: settings
              }
          };
          newNodes.push(resultNode);
          
          newConnections.push({
              id: uuid(),
              fromNode: sourceNodeId,
              toNode: newId
          });
      }
      
      // 新增節點和連線
      setNodes(prev => [...prev, ...newNodes]);
      setConnections(prev => [...prev, ...newConnections]);
      nodesRef.current = [...nodesRef.current, ...newNodes];
      connectionsRef.current = [...connectionsRef.current, ...newConnections];
      
      console.log(`[BP/Idea批次] 已建立 ${count} 個影象節點，開始併發執行`);
      
      // 併發執行所有結果節點的生成
      const execPromises = resultNodeIds.map(async (nodeId, index) => {
          const abortController = new AbortController();
          abortControllersRef.current.set(nodeId, abortController);
          const signal = abortController.signal;
          
          try {
              let result: string | null = null;
              
              const aspectRatio = settings.aspectRatio || 'AUTO';
              const resolution = settings.resolution || '2K';
              
              // 🔧 修復：AUTO 比例在圖生圖時不應該轉換為 1:1
              let config: GenerationConfig | undefined = undefined;
              
              if (inputImages.length > 0) {
                  // 圖生圖：AUTO 時只傳 resolution，不傳 aspectRatio，讓 API 使用原圖比例
                  if (aspectRatio === 'AUTO') {
                      config = { resolution };
                  } else {
                      config = { aspectRatio, resolution };
                  }
                  result = await editCreativeImage(inputImages, finalPrompt, config, signal);
              } else {
                  // 文生圖：AUTO 預設使用 1:1
                  config = aspectRatio !== 'AUTO' 
                      ? { aspectRatio, resolution }
                      : { aspectRatio: '1:1', resolution };
                  result = await generateCreativeImage(finalPrompt, config, signal);
              }
              
              if (!signal.aborted) {
                  updateNode(nodeId, { 
                      content: result || '', 
                      status: result ? 'completed' : 'error' 
                  });
                  
                  if (result && onImageGenerated) {
                      onImageGenerated(result, finalPrompt, currentCanvasId || undefined, canvasName);
                  }
                  
                  console.log(`[BP/Idea批次] 結果 ${index + 1} 完成`);
              }
          } catch (err) {
              if (!signal.aborted) {
                  updateNode(nodeId, { status: 'error' });
                  console.error(`[BP/Idea批次] 結果 ${index + 1} 失敗:`, err);
              }
          } finally {
              abortControllersRef.current.delete(nodeId);
          }
      });
      
      await Promise.all(execPromises);
      
      // 標記源節點為完成
      updateNode(sourceNodeId, { status: 'completed' });
      
      saveCurrentCanvas();
      console.log(`[BP/Idea批次] 全部完成`);
  };

  // 工具節點批次執行（remove-bg/upscale）：建立多個結果節點
  const handleToolBatchExecute = async (sourceNodeId: string, sourceNode: CanvasNode, count: number) => {
      // 立即標記源節點為 running，防止重複點選
      updateNode(sourceNodeId, { status: 'running' });
      
      console.log(`[工具批次] 開始生成 ${count} 個結果節點`);
      
      // 獲取源節點的位置和輸入
      const inputs = resolveInputs(sourceNodeId);
      const inputImages = inputs.images;
      
      if (inputImages.length === 0) {
          console.warn('[工具批次] 無輸入圖片，無法執行');
          updateNode(sourceNodeId, { status: 'error' });
          return;
      }
      
      // 建立結果節點，並自動連線到源節點
      const resultNodeIds: string[] = [];
      const newNodes: CanvasNode[] = [];
      const newConnections: Connection[] = [];
      
      // 計算結果節點的位置（源節點右側，垂直排列）
      const baseX = sourceNode.x + sourceNode.width + 150; // 距離源節點150px
      const nodeHeight = 300; // 預估節點高度
      const gap = 20; // 節點間距
      const totalHeight = count * nodeHeight + (count - 1) * gap;
      const startY = sourceNode.y + (sourceNode.height / 2) - (totalHeight / 2);
      
      for (let i = 0; i < count; i++) {
          const newId = uuid();
          resultNodeIds.push(newId);
          
          const resultNode: CanvasNode = {
              id: newId,
              type: 'image',
              content: '',
              x: baseX,
              y: startY + i * (nodeHeight + gap),
              width: 300,
              height: 300,
              status: 'running', // 建立時就設為running
              data: {}
          };
          newNodes.push(resultNode);
          
          // 建立連線：源節點 -> 結果節點
          newConnections.push({
              id: uuid(),
              fromNode: sourceNodeId,
              toNode: newId
          });
      }
      
      // 新增節點和連線
      setNodes(prev => [...prev, ...newNodes]);
      setConnections(prev => [...prev, ...newConnections]);
      
      // 更新ref
      nodesRef.current = [...nodesRef.current, ...newNodes];
      connectionsRef.current = [...connectionsRef.current, ...newConnections];
      
      console.log(`[工具批次] 已建立 ${count} 個結果節點，開始併發執行`);
      
      // 併發執行所有結果節點的生成
      const execPromises = resultNodeIds.map(async (nodeId, index) => {
          const abortController = new AbortController();
          abortControllersRef.current.set(nodeId, abortController);
          const signal = abortController.signal;
          
          try {
              let result: string | null = null;
              
              if (sourceNode.type === 'remove-bg') {
                  const prompt = "Remove the background, keep subject on transparent or white background";
                  result = await editCreativeImage([inputImages[0]], prompt, undefined, signal);
              } else if (sourceNode.type === 'upscale') {
                  const prompt = "Upscale this image to high resolution while preserving all original details, colors, and composition. Enhance clarity and sharpness without altering the content.";
                  const upscaleResolution = sourceNode.data?.settings?.resolution || '2K';
                  const upscaleConfig: GenerationConfig = {
                      resolution: upscaleResolution as '1K' | '2K' | '4K'
                  };
                  result = await editCreativeImage([inputImages[0]], prompt, upscaleConfig, signal);
              }
              
              if (!signal.aborted) {
                  if (result) {
                      // 提取圖片後設資料
                      const metadata = await extractImageMetadata(result);
                      
                      updateNode(nodeId, { 
                          content: result, 
                          status: 'completed',
                          data: { imageMetadata: metadata }
                      });
                  } else {
                      updateNode(nodeId, { status: 'error' });
                  }
              }
          } catch (err) {
              if (!signal.aborted) {
                  updateNode(nodeId, { status: 'error' });
                  console.error(`[工具批次] 結果 ${index + 1} 失敗:`, err);
              }
          } finally {
              abortControllersRef.current.delete(nodeId);
          }
      });
      
      // 等待所有執行完成
      await Promise.all(execPromises);
      
      // 標記源節點為完成
      updateNode(sourceNodeId, { status: 'completed' });
      
      console.log(`[工具批次] 全部完成`);
  };

  // 影片節點批次執行：建立多個 video-output 節點
  const handleVideoBatchExecute = async (sourceNodeId: string, sourceNode: CanvasNode, count: number) => {
      // 立即標記源節點為 running，防止重複點選
      updateNode(sourceNodeId, { status: 'running' });
      
      console.log(`[影片批次] 開始生成 ${count} 個影片輸出節點`);
      
      // 獲取輸入
      const inputs = resolveInputs(sourceNodeId);
      const nodePrompt = sourceNode.data?.prompt || '';
      const inputTexts = inputs.texts.join('\n');
      const combinedPrompt = nodePrompt || inputTexts;
      const inputImages = inputs.images;
      
      if (!combinedPrompt) {
          console.error('[影片批次] 無提示詞');
          updateNode(sourceNodeId, { status: 'error' });
          return;
      }
      
      // 建立結果節點（video-output 型別）
      const resultNodeIds: string[] = [];
      const newNodes: CanvasNode[] = [];
      const newConnections: Connection[] = [];
      
      const baseX = sourceNode.x + sourceNode.width + 150;
      const nodeHeight = 300;
      const nodeWidth = 400;
      const gap = 20;
      const totalHeight = count * nodeHeight + (count - 1) * gap;
      const startY = sourceNode.y + (sourceNode.height / 2) - (totalHeight / 2);
      
      for (let i = 0; i < count; i++) {
          const newId = uuid();
          resultNodeIds.push(newId);
          
          const resultNode: CanvasNode = {
              id: newId,
              type: 'video-output',
              title: `影片 ${i + 1}`,
              content: '',
              x: baseX,
              y: startY + i * (nodeHeight + gap),
              width: nodeWidth,
              height: nodeHeight,
              status: 'running',
              data: {}
          };
          newNodes.push(resultNode);
          
          newConnections.push({
              id: uuid(),
              fromNode: sourceNodeId,
              toNode: newId
          });
      }
      
      // 新增節點和連線
      setNodes(prev => [...prev, ...newNodes]);
      setConnections(prev => [...prev, ...newConnections]);
      nodesRef.current = [...nodesRef.current, ...newNodes];
      connectionsRef.current = [...connectionsRef.current, ...newConnections];
      setHasUnsavedChanges(true);
      
      console.log(`[影片批次] 已建立 ${count} 個影片輸出節點，開始併發執行`);
      
      // 獲取影片設定
      const videoService = sourceNode.data?.videoService || 'sora';
      
      // 併發執行所有結果節點的生成
      const execPromises = resultNodeIds.map(async (outputNodeId, index) => {
          const abortController = new AbortController();
          abortControllersRef.current.set(outputNodeId, abortController);
          const signal = abortController.signal;
          
          try {
              // 處理圖片輸入（如果有）
              let processedImages: string[] = [];
              if (inputImages.length > 0) {
                  for (const imgSrc of inputImages) {
                      if (imgSrc.startsWith('data:')) {
                          processedImages.push(imgSrc);
                      } else if (imgSrc.startsWith('/files/')) {
                          const fullUrl = `${window.location.origin}${imgSrc}`;
                          const resp = await fetch(fullUrl);
                          const blob = await resp.blob();
                          const base64 = await new Promise<string>(resolve => {
                              const reader = new FileReader();
                              reader.onloadend = () => resolve(reader.result as string);
                              reader.readAsDataURL(blob);
                          });
                          processedImages.push(base64);
                      }
                  }
              }
              
              if (videoService === 'veo') {
                  // ===== Veo 影片生成 =====
                  const { createVeoTask, waitForVeoCompletion } = await import('../../services/veoService');
                  
                  const veoMode = sourceNode.data?.veoMode || 'text2video';
                  const veoModel = sourceNode.data?.veoModel || 'veo3.1-fast';
                  const veoAspectRatio = sourceNode.data?.veoAspectRatio || '16:9';
                  const veoEnhancePrompt = sourceNode.data?.veoEnhancePrompt ?? false;
                  const veoEnableUpsample = sourceNode.data?.veoEnableUpsample ?? false;
                  
                  console.log(`[影片批次] Veo 開始生成 ${index + 1}:`, {
                      mode: veoMode,
                      model: veoModel,
                      aspectRatio: veoAspectRatio,
                      enhancePrompt: veoEnhancePrompt,
                      enableUpsample: veoEnableUpsample,
                      prompt: combinedPrompt.slice(0, 100)
                  });
                  
                  const taskId = await createVeoTask({
                      prompt: combinedPrompt,
                      model: veoModel as any,
                      images: processedImages.length > 0 ? processedImages : undefined,
                      aspectRatio: veoAspectRatio as any,
                      enhancePrompt: veoEnhancePrompt,
                      enableUpsample: veoEnableUpsample
                  });
                  
                  console.log(`[影片批次] Veo 任務已建立 ${index + 1}, taskId:`, taskId);
                  
                  updateNode(outputNodeId, { data: { videoTaskId: taskId } });
                  
                  const videoUrl = await waitForVeoCompletion(taskId, (progress, status) => {
                      updateNode(outputNodeId, { data: { ...nodesRef.current.find(n => n.id === outputNodeId)?.data, videoProgress: progress, videoTaskStatus: status } });
                  });
                  
                  if (signal.aborted) return;
                  
                  if (videoUrl) {
                      await downloadAndSaveVideo(videoUrl, outputNodeId, signal);
                  } else {
                      throw new Error('未返回影片URL');
                  }
              } else {
                  // ===== Sora 影片生成 =====
                  const { createVideoTask, waitForVideoCompletion } = await import('../../services/soraService');
                  
                  const videoModel = sourceNode.data?.videoModel || 'sora-2';
                  const videoSize = sourceNode.data?.videoSize || '1280x720';
                  const aspectRatio = videoSize === '720x1280' ? '9:16' : '16:9';
                  const duration = sourceNode.data?.videoSeconds || '10';
                  const hd = videoModel === 'sora-2-pro';
                  
                  console.log(`[影片批次] Sora 開始生成 ${index + 1}:`, {
                      model: videoModel,
                      aspectRatio,
                      duration,
                      prompt: combinedPrompt.slice(0, 100)
                  });
                  
                  const taskId = await createVideoTask({
                      prompt: combinedPrompt,
                      model: videoModel as any,
                      images: processedImages.length > 0 ? processedImages : undefined,
                      aspectRatio: aspectRatio as any,
                      hd: hd,
                      duration: duration as any
                  });
                  
                  console.log(`[影片批次] Sora 任務已建立 ${index + 1}, taskId:`, taskId);
                  
                  updateNode(outputNodeId, { data: { videoTaskId: taskId } });
                  
                  const videoUrl = await waitForVideoCompletion(taskId, (progress, status) => {
                      updateNode(outputNodeId, { data: { ...nodesRef.current.find(n => n.id === outputNodeId)?.data, videoProgress: progress, videoTaskStatus: status } });
                  });
                  
                  if (signal.aborted) return;
                  
                  if (videoUrl) {
                      await downloadAndSaveVideo(videoUrl, outputNodeId, signal);
                  } else {
                      throw new Error('未返回影片URL');
                  }
              }
              
              console.log(`[影片批次] 結果 ${index + 1} 完成`);
          } catch (err) {
              console.error(`[影片批次] 結果 ${index + 1} 失敗:`, err);
              if (!signal.aborted) {
                  updateNode(outputNodeId, { 
                      status: 'error',
                      data: { ...nodesRef.current.find(n => n.id === outputNodeId)?.data, videoFailReason: err instanceof Error ? err.message : String(err) }
                  });
              }
          } finally {
              abortControllersRef.current.delete(outputNodeId);
          }
      });
      
      await Promise.all(execPromises);
      
      // 標記源節點為完成
      updateNode(sourceNodeId, { status: 'completed' });
      
      saveCurrentCanvas();
      console.log(`[影片批次] 全部完成`);
  };

  const handleExecuteNode = async (nodeId: string, batchCount: number = 1) => {
      const node = nodesRef.current.find(n => n.id === nodeId);
      if (!node) {
          console.warn(`[執行] 節點 ${nodeId.slice(0,8)} 不存在`);
          return;
      }
      
      // 🔒 原子操作：防止重複執行（關鍵修復點）
      if (executingNodesRef.current.has(nodeId)) {
          console.warn(`[🔒執行鎖] 節點 ${nodeId.slice(0,8)} 正在執行中，阻止重複請求`);
          return;
      }
      
      // 立即標記為執行中（在任何非同步操作之前）
      executingNodesRef.current.add(nodeId);
      console.log(`[🔒執行鎖] 節點 ${nodeId.slice(0,8)} 已加鎖，開始執行`);
      
      // 防止重複執行：如果節點已經在執行中，直接返回
      if (node.status === 'running') {
          console.warn(`[執行] 節點 ${nodeId.slice(0,8)} 已在執行中，忽略重複請求`);
          executingNodesRef.current.delete(nodeId); // 解鎖
          return;
      }
      
      // 檢查是否已有未完成的abortController
      if (abortControllersRef.current.has(nodeId)) {
          console.warn(`[執行] 節點 ${nodeId.slice(0,8)} 存在未清理的abortController，先取消舊任務`);
          const oldController = abortControllersRef.current.get(nodeId);
          oldController?.abort();
          abortControllersRef.current.delete(nodeId);
      }

      // 批次生成：建立多個結果節點
      if (batchCount > 1 && ['image', 'edit'].includes(node.type)) {
          try {
              await handleBatchExecute(nodeId, node, batchCount);
          } finally {
              executingNodesRef.current.delete(nodeId); // 解鎖
          }
          return;
      }
      
      // 工具節點批次執行：自動建立影象節點
      if (batchCount >= 1 && ['remove-bg', 'upscale'].includes(node.type)) {
          try {
              await handleToolBatchExecute(nodeId, node, batchCount);
          } finally {
              executingNodesRef.current.delete(nodeId); // 解鎖
          }
          return;
      }
      
      // BP/Idea節點批次執行：自動建立影象節點
      if (batchCount >= 1 && ['bp', 'idea'].includes(node.type)) {
          try {
              await handleBpIdeaBatchExecute(nodeId, node, batchCount);
          } finally {
              executingNodesRef.current.delete(nodeId); // 解鎖
          }
          return;
      }
      
      // 影片節點批次執行：自動建立 video-output 節點
      if (batchCount >= 1 && node.type === 'video') {
          try {
              await handleVideoBatchExecute(nodeId, node, batchCount);
          } finally {
              executingNodesRef.current.delete(nodeId); // 解鎖
          }
          return;
      }

      // Create abort controller for this execution
      const abortController = new AbortController();
      abortControllersRef.current.set(nodeId, abortController);
      const signal = abortController.signal;

      updateNode(nodeId, { status: 'running' });

      try {
          // 級聯執行：先執行上游未完成的節點
          const inputConnections = connectionsRef.current.filter(c => c.toNode === nodeId);
          console.log(`[級聯執行] 節點 ${nodeId.slice(0,8)} 有 ${inputConnections.length} 個上游連線`);
          
          for (const conn of inputConnections) {
              const upstreamNode = nodesRef.current.find(n => n.id === conn.fromNode);
              console.log(`[級聯執行] 上游節點:`, {
                  id: upstreamNode?.id.slice(0,8),
                  type: upstreamNode?.type,
                  status: upstreamNode?.status
              });
              
              // 如果上游節點需要執行且未完成，先執行上游
              if (upstreamNode && upstreamNode.status !== 'completed') {
                  // 只有 idle 狀態的節點才需要級聯執行（關鍵修復點）
                  // running: 已在執行，等待完成
                  // error: 已失敗，不重試
                  if (upstreamNode.status !== 'idle') {
                      console.log(`[級聯執行] ⚠️ 上游節點狀態為 ${upstreamNode.status}，跳過級聯執行`);
                      continue; // 跳過這個上游節點
                  }
                  
                  // 可執行的節點型別：包含 image 以支援容器模式級聯執行
                  const executableTypes = ['image', 'llm', 'edit', 'remove-bg', 'upscale', 'resize', 'video', 'bp'];
                  if (executableTypes.includes(upstreamNode.type)) {
                      console.log(`[級聯執行] ⤵️ 觸發上游節點執行: ${upstreamNode.type} ${upstreamNode.id.slice(0,8)}`);
                      // 遞迴執行上游節點
                      await handleExecuteNode(upstreamNode.id);
                      console.log(`[級聯執行] ✅ 上游節點執行完成`);
                  }
              } else if (upstreamNode) {
                  console.log(`[級聯執行] ✅ 上游節點已完成，無需重新執行`);
              }
          }
          
          // 檢查是否被中斷
          if (signal.aborted) return;

          // Resolve all inputs (recursive for edits/relays) - 向上追溯
          const inputs = resolveInputs(nodeId);
          
          if (node.type === 'image') {
              // 獲取節點自身的prompt
              const nodePrompt = node.data?.prompt || '';
              // 上游輸入的文字
              const inputTexts = inputs.texts.join('\n');
              // 上游圖片
              const inputImages = inputs.images;
              
              // 從上游節點獲取設定（支援idea節點）
              let upstreamSettings: any = null;
              let upstreamPrompt = '';
              const inputConnections = connectionsRef.current.filter(c => c.toNode === nodeId);
              for (const conn of inputConnections) {
                  const upstreamNode = nodesRef.current.find(n => n.id === conn.fromNode);
                  if (upstreamNode?.type === 'idea' && upstreamNode.data?.settings) {
                      // 從idea節點繼承設定
                      upstreamSettings = upstreamNode.data.settings;
                      if (!nodePrompt && upstreamNode.content) {
                          upstreamPrompt = upstreamNode.content;
                      }
                      break;
                  } else if (upstreamNode?.type === 'image' && upstreamNode.data?.prompt && !nodePrompt) {
                      // 從上游image節點繼承prompt
                      upstreamPrompt = upstreamNode.data.prompt;
                  }
              }
              
              // 合併prompt：自身 > 上游節點prompt > 上游文字輸入
              const combinedPrompt = nodePrompt || upstreamPrompt || inputTexts;
              
              // 合併設定：自身 > 上游節點設定 > 預設
              const effectiveSettings = node.data?.settings || upstreamSettings || {};
              
              // 獲取圖片：優先用上游輸入，其次用節點自身的圖片
              let imageSource: string[] = [];
              if (inputImages.length > 0) {
                  // 有上游圖片輸入
                  imageSource = inputImages;
              } else if (isValidImage(node.content)) {
                  // 沒有上游圖片，但節點自身有圖片
                  imageSource = [node.content];
              }
              
              // 執行邏輯：
              // 1. 無prompt + 無圖片 = 不執行（但如果是上傳的圖片，應該已經是completed狀態）
              // 2. 有prompt + 無圖片 = 文生圖
              // 3. 無prompt + 有圖片 = 傳遞圖片（容器模式）
              // 4. 有prompt + 有圖片 = 圖生圖
              
              console.log('[Image節點] 執行前檢查:', {
                  nodeId: nodeId.slice(0, 8),
                  hasCombinedPrompt: !!combinedPrompt,
                  imageSourceLength: imageSource.length,
                  nodeContent: node.content?.slice(0, 100),
                  isValidContent: isValidImage(node.content)
              });
              
              if (!combinedPrompt && imageSource.length === 0) {
                  // 無prompt + 無圖片 = 不執行
                  // 特殊情況：如果節點本身就有content（使用者上傳的圖片或畫布恢復的），標記為completed
                  if (isValidImage(node.content)) {
                      console.log('[Image節點] ✅ 已有圖片內容，直接標記為completed');
                      updateNode(nodeId, { status: 'completed' });
                  } else {
                      console.error('[Image節點] ❌ 執行失敗：無提示詞且無圖片，content:', node.content);
                      updateNode(nodeId, { status: 'error' });
                  }
              } else if (combinedPrompt && imageSource.length === 0) {
                  // 有prompt + 無圖片 = 文生圖
                  // 使用effectiveSettings（合併後的設定）
                  const imgAspectRatio = effectiveSettings.aspectRatio || 'AUTO';
                  const imgResolution = effectiveSettings.resolution || '2K';
                  const imgConfig = imgAspectRatio !== 'AUTO' 
                      ? { aspectRatio: imgAspectRatio, resolution: imgResolution as '1K' | '2K' | '4K' }
                      : { aspectRatio: '1:1', resolution: imgResolution as '1K' | '2K' | '4K' }; // 文生圖預設1:1
                  
                  const result = await generateCreativeImage(combinedPrompt, imgConfig, signal);
                  if (!signal.aborted) {
                      updateNode(nodeId, { content: result || '', status: result ? 'completed' : 'error' });
                      // 立即儲存畫布（避免切換TAB時資料丟失）
                      saveCurrentCanvas();
                      // 同步到桌面
                      if (result && onImageGenerated) {
                          onImageGenerated(result, combinedPrompt, currentCanvasId || undefined, canvasName);
                      }
                  }
              } else if (!combinedPrompt && imageSource.length > 0) {
                  // 無prompt + 有圖片 = 傳遞圖片（容器模式）
                  if (!signal.aborted) {
                      updateNode(nodeId, { content: imageSource[0], status: 'completed' });
                  }
              } else {
                  // 有prompt + 有圖片 = 圖生圖
                  // 🔧 修復：正確使用 effectiveSettings（合併後的設定）
                  const imgAspectRatio = effectiveSettings.aspectRatio || 'AUTO';
                  const imgResolution = effectiveSettings.resolution || '1K';
                  
                  let imgConfig: GenerationConfig | undefined = undefined;
                  if (imgAspectRatio === 'AUTO') {
                      // AUTO 模式：只傳 resolution（如果不是預設值），保持原圖比例
                      if (imgResolution !== 'AUTO' && imgResolution !== '1K') {
                          imgConfig = { resolution: imgResolution as '1K' | '2K' | '4K' };
                      }
                  } else {
                      // 使用者指定了比例
                      imgConfig = { 
                          aspectRatio: imgAspectRatio, 
                          resolution: imgResolution !== 'AUTO' ? imgResolution as '1K' | '2K' | '4K' : '1K'
                      };
                  }
                  
                  console.log('[Image節點] 圖生圖配置:', { imgAspectRatio, imgResolution, imgConfig });
                  const result = await editCreativeImage(imageSource, combinedPrompt, imgConfig, signal);
                  if (!signal.aborted) {
                      updateNode(nodeId, { content: result || '', status: result ? 'completed' : 'error' });
                      // 立即儲存畫布（避免切換TAB時資料丟失）
                      saveCurrentCanvas();
                      // 同步到桌面
                      if (result && onImageGenerated) {
                          onImageGenerated(result, combinedPrompt, currentCanvasId || undefined, canvasName);
                      }
                  }
              }
          }
          else if (node.type === 'edit') {
               // Magic節點執行邏輯
               const inputTexts = inputs.texts.join('\n');
               const inputImages = inputs.images;
                         
               // 獲取節點的設定和提示詞
               const nodePrompt = node.data?.prompt || '';
               const combinedPrompt = nodePrompt || inputTexts;
                         
              // 獲取Edit節點的設定
               const editAspectRatio = node.data?.settings?.aspectRatio || 'AUTO';
               const editResolution = node.data?.settings?.resolution || 'AUTO';
               
               console.log('[Magic] 節點設定:', {
                   aspectRatio: editAspectRatio,
                   resolution: editResolution,
                   nodeSettings: node.data?.settings
               });
                         
               // 🔧 修復：AUTO 比例應該傳遞給服務層，讓服務層根據是否有輸入圖片決定處理方式
               let finalConfig: GenerationConfig | undefined = undefined;
               const hasInputImages = inputImages.length > 0;
                         
               if (editAspectRatio === 'AUTO' && hasInputImages) {
                   // 圖生圖 + AUTO：只傳遞 resolution（如果不是 AUTO），不傳 aspectRatio
                   if (editResolution !== 'AUTO') {
                       finalConfig = {
                           resolution: editResolution as '1K' | '2K' | '4K'
                       };
                   }
               } else if (editAspectRatio !== 'AUTO' || editResolution !== 'AUTO') {
                   finalConfig = {
                       aspectRatio: editAspectRatio !== 'AUTO' ? editAspectRatio : '1:1',
                       resolution: editResolution !== 'AUTO' ? editResolution as '1K' | '2K' | '4K' : '1K'
                   };
               }
               
               console.log('[Magic] 構建的 finalConfig:', finalConfig);
                         
               // 🔧 關鍵修復：檢查是否已有下游節點（使用者手動連線的）
               const existingDownstream = connectionsRef.current.filter(c => c.fromNode === nodeId);
               const hasExistingOutput = existingDownstream.length > 0;
                         
               console.log(`[Magic] 開始執行, 已有下游連線: ${hasExistingOutput}`);
                         
               let outputNodeId: string;
                         
               if (hasExistingOutput) {
                   // 💡 已有下游節點，不建立新節點，更新現有的第一個下游節點
                   outputNodeId = existingDownstream[0].toNode;
                   const existingNode = nodesRef.current.find(n => n.id === outputNodeId);
                   console.log(`[Magic] 使用現有下游節點 ${outputNodeId.slice(0,8)}, 型別: ${existingNode?.type}`);
                   // 更新現有節點為 running 狀態
                   updateNode(outputNodeId, { status: 'running' });
               } else {
                   // 🆕 沒有下游節點，建立新的 Image 節點
                   outputNodeId = uuid();
                   const outputNode: CanvasNode = {
                       id: outputNodeId,
                       type: 'image',
                       content: '',
                       x: node.x + node.width + 100,
                       y: node.y,
                       width: 300,
                       height: 300,
                       data: {},
                       status: 'running'
                   };
                             
                   const newConnection = {
                       id: uuid(),
                       fromNode: nodeId,
                       toNode: outputNodeId
                   };
                             
                   setNodes(prev => [...prev, outputNode]);
                   setConnections(prev => [...prev, newConnection]);
                   setHasUnsavedChanges(true);
                   console.log(`[Magic] 已建立新輸出節點 ${outputNodeId.slice(0,8)}`);
               }
                         
               // 呼叫API
               try {
                   let result: string | null = null;
                             
                   if (!combinedPrompt && inputImages.length === 0) {
                       console.warn('[Magic] 無prompt且無圖片，無法執行');
                       updateNode(outputNodeId, { status: 'error' });
                       updateNode(nodeId, { status: 'error' });
                       return;
                   } else if (combinedPrompt && inputImages.length === 0) {
                       result = await generateCreativeImage(combinedPrompt, finalConfig, signal);
                   } else if (!combinedPrompt && inputImages.length > 0) {
                       result = inputImages[0];
                       updateNode(nodeId, { status: 'completed' });
                   } else {
                       result = await editCreativeImage(inputImages, combinedPrompt, finalConfig, signal);
                   }
                             
                   if (!signal.aborted) {
                       if (result) {
                           console.log(`[Magic] API返回成功,更新輸出節點內容`);
                           const metadata = await extractImageMetadata(result);
                           updateNode(outputNodeId, { 
                               content: result,
                               status: 'completed',
                               data: { imageMetadata: metadata }
                           });
                           updateNode(nodeId, { status: 'completed' });
                       } else {
                           updateNode(outputNodeId, { status: 'error' });
                           updateNode(nodeId, { status: 'error' });
                       }
                   }
               } catch (error) {
                   console.error('[Magic] 執行失敗:', error);
                   updateNode(outputNodeId, { status: 'error' });
                   updateNode(nodeId, { status: 'error' });
               }
          }
          else if (node.type === 'video') {
               // Video節點：支援 Sora 和 Veo3.1 生成影片（非同步任務）
               const nodePrompt = node.data?.prompt || '';
               const inputTexts = inputs.texts.join('\n');
               const combinedPrompt = nodePrompt || inputTexts;
               const inputImages = inputs.images;
               const videoService = node.data?.videoService || 'sora';
               
               console.log('[Video節點] ========== 開始處理 ==========');
               console.log('[Video節點] 服務型別:', videoService);
               console.log('[Video節點] inputImages:', {
                   count: inputImages.length,
                   hasImages: inputImages.length > 0,
                   preview: inputImages.map(img => img.slice(0, 50))
               });
               
               // 🔍 詳細檢查圖片格式
               if (inputImages.length > 0) {
                   inputImages.forEach((img, idx) => {
                       const isBase64 = img.startsWith('data:image');
                       const isLocalPath = img.startsWith('/files/');
                       const isHttpUrl = img.startsWith('http://') || img.startsWith('https://');
                       console.log(`[Video節點] 圖片 ${idx + 1} 格式:`, {
                           isBase64,
                           isLocalPath,
                           isHttpUrl,
                           length: img.length,
                           preview: img.slice(0, 100)
                       });
                   });
               }
               
               // 檢查是否有儲存的任務ID（恢復場景）
               const savedTaskId = node.data?.videoTaskId;
               const hasVideoContent = isValidVideo(node.content);
               
               // 如果節點狀態是 running 但沒有內容，說明是恢復的未完成任務
               if (node.status === 'running' && savedTaskId && !hasVideoContent) {
                   console.log('[Video節點] 檢測到未完成的任務，恢復輪詢:', savedTaskId);
                   try {
                       if (videoService === 'veo') {
                           // Veo3.1 任務恢復
                           const { getVeoTaskStatus, waitForVeoCompletion } = await import('../../services/veoService');
                           const taskStatus = await getVeoTaskStatus(savedTaskId);
                           console.log('[Video節點] Veo任務當前狀態:', taskStatus.status);
                           
                           updateNode(nodeId, {
                               data: { 
                                   ...node.data, 
                                   videoTaskStatus: taskStatus.status,
                                   videoFailReason: taskStatus.failReason
                               }
                           });
                           
                           if (taskStatus.status === 'SUCCESS' && taskStatus.videoUrl) {
                               await downloadAndSaveVideo(taskStatus.videoUrl, nodeId, signal);
                           } else if (taskStatus.status === 'FAILURE') {
                               updateNode(nodeId, { 
                                   status: 'error',
                                   data: { ...node.data, videoTaskId: undefined, videoTaskStatus: 'FAILURE', videoFailReason: taskStatus.failReason || '未知錯誤' }
                               });
                           } else {
                               const videoUrl = await waitForVeoCompletion(savedTaskId, (progress, status) => {
                                   updateNode(nodeId, { data: { ...nodesRef.current.find(n => n.id === nodeId)?.data, videoProgress: progress, videoTaskStatus: status } });
                               });
                               if (!signal.aborted && videoUrl) {
                                   await downloadAndSaveVideo(videoUrl, nodeId, signal);
                               }
                           }
                       } else {
                           // Sora 任務恢復
                           const { getTaskStatus, waitForVideoCompletion } = await import('../../services/soraService');
                           const taskStatus = await getTaskStatus(savedTaskId);
                           console.log('[Video節點] Sora任務當前狀態:', taskStatus.status);
                           
                           updateNode(nodeId, {
                               data: { ...node.data, videoTaskStatus: taskStatus.status, videoFailReason: taskStatus.fail_reason }
                           });
                           
                           if (taskStatus.status === 'SUCCESS' && taskStatus.data?.output) {
                               await downloadAndSaveVideo(taskStatus.data.output, nodeId, signal);
                           } else if (taskStatus.status === 'FAILURE') {
                               updateNode(nodeId, { 
                                   status: 'error',
                                   data: { ...node.data, videoTaskId: undefined, videoTaskStatus: 'FAILURE', videoFailReason: taskStatus.fail_reason || '未知錯誤' }
                               });
                           } else {
                               const videoUrl = await waitForVideoCompletion(savedTaskId, (progress, status) => {
                                   updateNode(nodeId, { data: { ...nodesRef.current.find(n => n.id === nodeId)?.data, videoProgress: progress, videoTaskStatus: status } });
                               });
                               if (!signal.aborted && videoUrl) {
                                   await downloadAndSaveVideo(videoUrl, nodeId, signal);
                               }
                           }
                       }
                   } catch (err) {
                       console.error('[Video節點] 恢復任務失敗:', err);
                       updateNode(nodeId, { 
                           status: 'error',
                           data: { ...node.data, videoTaskId: undefined, videoTaskStatus: 'FAILURE', videoFailReason: err instanceof Error ? err.message : String(err) }
                       });
                   }
                   return;
               }
               
               // 前置驗證：提前檢查必需引數
               if (!combinedPrompt) {
                   updateNode(nodeId, { status: 'error' });
                   console.warn('[Video節點] 執行失敗：無提示詞');
                   return;
               }
               
               // 📝 處理圖片資料：確保格式正確
               let processedImages: string[] = [];
               if (inputImages.length > 0) {
                   for (const img of inputImages) {
                       if (img.startsWith('/files/')) {
                           console.log('[Video節點] 檢測到本地路徑，開始轉換為 base64:', img);
                           try {
                               const fullUrl = `${window.location.origin}${img}`;
                               const response = await fetch(fullUrl);
                               if (!response.ok) throw new Error(`獲取圖片失敗: ${response.status}`);
                               const blob = await response.blob();
                               const base64 = await new Promise<string>((resolve, reject) => {
                                   const reader = new FileReader();
                                   reader.onloadend = () => resolve(reader.result as string);
                                   reader.onerror = reject;
                                   reader.readAsDataURL(blob);
                               });
                               console.log('[Video節點] 本地路徑已轉換為 base64, 大小:', (base64.length / 1024).toFixed(2), 'KB');
                               processedImages.push(base64);
                           } catch (err) {
                               console.error('[Video節點] 轉換本地圖片失敗:', err);
                               throw new Error(`無法讀取本地圖片: ${img}`);
                           }
                       } else if (img.startsWith('data:image')) {
                           const match = img.match(/^data:image\/(\w+);base64,/);
                           if (match) {
                               const format = match[1].toLowerCase();
                               if (['png', 'jpg', 'jpeg', 'webp'].includes(format)) {
                                   processedImages.push(img);
                               } else {
                                   throw new Error(`不支援的圖片格式: ${format}`);
                               }
                           } else {
                               throw new Error('Base64 圖片格式錯誤');
                           }
                       } else if (img.startsWith('http://') || img.startsWith('https://')) {
                           if (img.includes('localhost') || img.includes('127.0.0.1')) {
                               try {
                                   const response = await fetch(img);
                                   if (!response.ok) throw new Error(`獲取圖片失敗: ${response.status}`);
                                   const blob = await response.blob();
                                   const base64 = await new Promise<string>((resolve, reject) => {
                                       const reader = new FileReader();
                                       reader.onloadend = () => resolve(reader.result as string);
                                       reader.onerror = reject;
                                       reader.readAsDataURL(blob);
                                   });
                                   processedImages.push(base64);
                               } catch (err) {
                                   throw new Error(`無法讀取本地圖片: ${img}`);
                               }
                           } else {
                               processedImages.push(img);
                           }
                       } else {
                           throw new Error('不支援的圖片資料格式');
                       }
                   }
               }
               
               try {
                   if (videoService === 'veo') {
                       // ===== Veo3.1 影片生成 =====
                       const { createVeoTask, waitForVeoCompletion } = await import('../../services/veoService');
                       
                       const veoMode = node.data?.veoMode || 'text2video';
                       const veoModel = node.data?.veoModel || 'veo3.1-fast';
                       const veoAspectRatio = node.data?.veoAspectRatio || '16:9';
                       const veoEnhancePrompt = node.data?.veoEnhancePrompt ?? false;
                       const veoEnableUpsample = node.data?.veoEnableUpsample ?? false;
                       
                       // 校驗圖片數量
                       if (veoMode === 'image2video' && processedImages.length === 0) {
                           throw new Error('圖生影片模式需要連線1張圖片');
                       }
                       if (veoMode === 'keyframes' && processedImages.length < 2) {
                           throw new Error('首尾幀模式需要連線2張圖片（上=首幀，下=尾幀）');
                       }
                       if (veoMode === 'multi-reference' && processedImages.length === 0) {
                           throw new Error('多圖參考模式需要連線1-3張圖片');
                       }
                       
                       console.log('[Video節點] Veo3.1 開始生成:', {
                           mode: veoMode,
                           model: veoModel,
                           prompt: combinedPrompt.slice(0, 100),
                           aspectRatio: veoAspectRatio,
                           enhancePrompt: veoEnhancePrompt,
                           enableUpsample: veoEnableUpsample,
                           imagesCount: processedImages.length
                       });
                       
                       // 1. 建立 Veo 任務
                       const taskId = await createVeoTask({
                           prompt: combinedPrompt,
                           model: veoModel as any,
                           images: processedImages.length > 0 ? processedImages : undefined,
                           aspectRatio: veoAspectRatio as any,
                           enhancePrompt: veoEnhancePrompt,
                           enableUpsample: veoEnableUpsample
                       });
                       
                       console.log('[Video節點] Veo 任務已建立, taskId:', taskId);
                       
                       updateNode(nodeId, { data: { ...node.data, videoTaskId: taskId } });
                       saveCurrentCanvas();
                       
                       // 2. 輪詢等待完成
                       const videoUrl = await waitForVeoCompletion(taskId, (progress, status) => {
                           console.log(`[Video節點] Veo 進度: ${progress}%, 狀態: ${status}`);
                           updateNode(nodeId, { data: { ...nodesRef.current.find(n => n.id === nodeId)?.data, videoProgress: progress, videoTaskStatus: status } });
                       });
                       
                       if (signal.aborted) {
                           console.log('[Video節點] 任務已被中斷');
                           return;
                       }
                       
                       if (videoUrl) {
                           await downloadAndSaveVideo(videoUrl, nodeId, signal);
                       } else {
                           throw new Error('未返回影片URL');
                       }
                   } else {
                       // ===== Sora 影片生成 =====
                       const { createVideoTask, waitForVideoCompletion } = await import('../../services/soraService');
                       
                       const videoModel = node.data?.videoModel || 'sora-2';
                       const videoSize = node.data?.videoSize || '1280x720';
                       const aspectRatio = videoSize === '720x1280' ? '9:16' : '16:9';
                       const duration = node.data?.videoSeconds || '10';
                       const hd = videoModel === 'sora-2-pro';
                       
                       const isImageToVideo = processedImages.length > 0;
                       const videoType = isImageToVideo ? '圖生影片' : '文生影片';
                       
                       console.log('[Video節點] Sora 開始生成:', {
                           type: videoType,
                           prompt: combinedPrompt.slice(0, 100),
                           model: videoModel,
                           aspectRatio,
                           duration,
                           imagesCount: processedImages.length
                       });
                       
                       // 1. 建立 Sora 任務
                       const taskId = await createVideoTask({
                           prompt: combinedPrompt,
                           model: videoModel as any,
                           images: processedImages.length > 0 ? processedImages : undefined,
                           aspectRatio: aspectRatio as any,
                           hd: hd,
                           duration: duration as any
                       });
                       
                       console.log('[Video節點] Sora 任務已建立, taskId:', taskId);
                       
                       updateNode(nodeId, { data: { ...node.data, videoTaskId: taskId } });
                       saveCurrentCanvas();
                       
                       // 2. 輪詢等待完成
                       const videoUrl = await waitForVideoCompletion(taskId, (progress, status) => {
                           console.log(`[Video節點] Sora 進度: ${progress}%, 狀態: ${status}`);
                           updateNode(nodeId, { data: { ...nodesRef.current.find(n => n.id === nodeId)?.data, videoProgress: progress, videoTaskStatus: status } });
                       });
                       
                       if (signal.aborted) {
                           console.log('[Video節點] 任務已被中斷');
                           return;
                       }
                       
                       if (videoUrl) {
                           await downloadAndSaveVideo(videoUrl, nodeId, signal);
                       } else {
                           throw new Error('未返回影片URL');
                       }
                   }
               } catch (err) {
                   console.error('[Video節點] 生成失敗:', err);
                   if (!signal.aborted) {
                       updateNode(nodeId, { 
                           status: 'error',
                           data: { ...node.data, videoTaskId: undefined, videoTaskStatus: 'FAILURE', videoFailReason: err instanceof Error ? err.message : String(err) }
                       });
                   }
               }
          }
          else if (node.type === 'idea' || node.type === 'text') {
               // Text/Idea節點：容器模式 - 接收上游文字內容
               // 重新獲取輸入（因為上游可能剛執行完）
               const freshInputs = resolveInputs(nodeId);
               const inputTexts = freshInputs.texts;
               
               // 檢查是否有上游連線
               const hasUpstreamConnection = connectionsRef.current.some(c => c.toNode === nodeId);
               
               // 如果有上游連線，作為純容器使用
               if (hasUpstreamConnection) {
                   if (inputTexts.length > 0) {
                       // 直接顯示上游內容（容器模式）
                       const mergedText = inputTexts.join('\n\n');
                       if (!signal.aborted) {
                           updateNode(nodeId, { 
                               content: mergedText, 
                               status: 'completed' 
                           });
                       }
                   } else {
                       // 上游還沒有輸出
                       updateNode(nodeId, { status: 'error' });
                       console.warn('上游節點無輸出');
                   }
               } else if (node.content) {
                   // 沒有上游連線，但有自身內容，使用LLM擴充套件
                   const result = await generateCreativeText(node.content);
                   if (!signal.aborted) {
                       updateNode(nodeId, { 
                           title: result.title, 
                           content: result.content, 
                           status: 'completed' 
                       });
                   }
               } else {
                   // 無上游輸入且無自身內容
                   updateNode(nodeId, { status: 'error' });
                   console.warn('文位元組點執行失敗：無內容');
               }
          }
          else if (node.type === 'llm') {
              // LLM節點：可以處理圖片+文字輸入
              // 執行後保持節點原貌，輸出存到 data.output 供下游獲取
              const nodePrompt = node.data?.prompt || '';
              const inputTexts = inputs.texts.join('\n');
              const userPrompt = nodePrompt || inputTexts;
              const systemPrompt = node.data?.systemInstruction;
              const inputImages = inputs.images;
              
              if (!userPrompt && inputImages.length === 0) {
                  updateNode(nodeId, { status: 'error' });
                  console.warn('LLM節點執行失敗：無輸入');
              } else {
                  const result = await generateAdvancedLLM(userPrompt, systemPrompt, inputImages);
                  if (!signal.aborted) {
                      // 輸出存到 data.output，不覆蓋節點顯示
                      updateNode(nodeId, { 
                          data: { ...node.data, output: result },
                          status: 'completed' 
                      });
                  }
              }
          }
          else if (node.type === 'resize') {
              // Resize節點：需要上游圖片輸入
              const inputImages = inputs.images;
              
              if (inputImages.length === 0) {
                  updateNode(nodeId, { status: 'error' });
                  console.warn('Resize節點執行失敗：無輸入圖片');
              } else {
                  const src = inputImages[0];
                  const mode = node.data?.resizeMode || 'longest';
                  const w = node.data?.resizeWidth || 1024;
                  const h = node.data?.resizeHeight || 1024;
                  const resized = await resizeImageClient(src, mode, w, h);
                  if (!signal.aborted) {
                      updateNode(nodeId, { content: resized, status: 'completed' });
                  }
              }
          }
          else if (node.type === 'remove-bg') {
              // Remove-BG節點:需要上游圖片輸入
              const inputImages = inputs.images;
                        
              if (inputImages.length === 0) {
                  updateNode(nodeId, { status: 'error' });
                  console.warn('Remove-BG節點執行失敗:無輸入圖片');
              } else {
                  // 🎯 修復:點選RUN立即建立輸出節點,顯示loading狀態
                  console.log(`[Remove-BG] 開始執行,立即建立輸出節點`);
                            
                  // 1. 立即建立右側Image節點(空白+loading)
                  const outputNodeId = uuid();
                  const outputNode: CanvasNode = {
                      id: outputNodeId,
                      type: 'image',
                      content: '', // 空白,等待API返回
                      x: node.x + node.width + 100,
                      y: node.y,
                      width: 300,
                      height: 300,
                      data: {},
                      status: 'running' // loading狀態
                  };
                            
                  const newConnection = {
                      id: uuid(),
                      fromNode: nodeId,
                      toNode: outputNodeId
                  };
                            
                  // 2. 立即更新UI:新增節點+連線
                  setNodes(prev => [...prev, outputNode]);
                  setConnections(prev => [...prev, newConnection]);
                  setHasUnsavedChanges(true);
                  console.log(`[Remove-BG] 已建立輸出節點 ${outputNodeId.slice(0,8)}, 狀態:running`);
                            
                  // 3. 呼叫API
                  const prompt = "Remove the background, keep subject on transparent or white background";
                  const result = await editCreativeImage([inputImages[0]], prompt, undefined, signal);
                            
                  if (!signal.aborted) {
                      if (result) {
                          console.log(`[Remove-BG] API返回成功,更新輸出節點內容`);
                                    
                          // 🔥 提取圖片後設資料
                          const metadata = await extractImageMetadata(result);
                          console.log(`[Remove-BG] 圖片後設資料:`, metadata);
                                    
                          // 4. 更新已存在的輸出節點:填充內容+後設資料
                          updateNode(outputNodeId, { 
                              content: result,
                              status: 'completed',
                              data: { imageMetadata: metadata }
                          });
                                    
                          // 5. 標記工具節點完成
                          updateNode(nodeId, { status: 'completed' });
                      } else {
                          // API失敗,更新輸出節點為error
                          updateNode(outputNodeId, { status: 'error' });
                          updateNode(nodeId, { status: 'error' });
                      }
                  }
              }
          }
          else if (node.type === 'upscale') {
              // Upscale節點:高畫質放大處理
              const inputImages = inputs.images;
                        
              console.log(`[Upscale] 收集到的輸入圖片數量: ${inputImages.length}`);
              if (inputImages.length > 0) {
                  console.log(`[Upscale] 圖片預覽:`, inputImages[0]?.slice(0, 80));
              }
                        
              if (inputImages.length === 0) {
                  updateNode(nodeId, { status: 'error' });
                  console.error('❌ Upscale節點執行失敗:無輸入圖片!請檢查上游節點是否已執行完成');
              } else {
                  // 🎯 修復:點選RUN立即建立輸出節點,顯示loading狀態
                  console.log(`[Upscale] 開始執行,立即建立輸出節點`);
                            
                  // 1. 立即建立右側Image節點(空白+loading)
                  const outputNodeId = uuid();
                  const outputNode: CanvasNode = {
                      id: outputNodeId,
                      type: 'image',
                      content: '', // 空白,等待API返回
                      x: node.x + node.width + 100,
                      y: node.y,
                      width: 300,
                      height: 300,
                      data: {},
                      status: 'running' // loading狀態
                  };
                            
                  const newConnection = {
                      id: uuid(),
                      fromNode: nodeId,
                      toNode: outputNodeId
                  };
                            
                  // 2. 立即更新UI:新增節點+連線
                  setNodes(prev => [...prev, outputNode]);
                  setConnections(prev => [...prev, newConnection]);
                  setHasUnsavedChanges(true);
                  console.log(`[Upscale] 已建立輸出節點 ${outputNodeId.slice(0,8)}, 狀態:running`);
                            
                  // 3. 呼叫API
                  const prompt = "Upscale this image to high resolution while preserving all original details, colors, and composition. Enhance clarity and sharpness without altering the content.";
                  const upscaleResolution = node.data?.settings?.resolution || '2K';
                  const upscaleConfig: GenerationConfig = {
                      resolution: upscaleResolution as '1K' | '2K' | '4K'
                  };
                  console.log(`[Upscale] 開始呼叫API,解析度: ${upscaleResolution}`);
                  const result = await editCreativeImage([inputImages[0]], prompt, upscaleConfig, signal);
                  console.log(`[Upscale] API呼叫完成,result:`, result ? `有圖片 (${result.slice(0,50)}...)` : 'null');
                            
                  if (!signal.aborted) {
                      if (result) {
                          console.log(`[Upscale] API返回成功,更新輸出節點內容`);
                                    
                          // 🔥 提取圖片後設資料
                          const metadata = await extractImageMetadata(result);
                          console.log(`[Upscale] 圖片後設資料:`, metadata);
                                    
                          // 4. 更新已存在的輸出節點:填充內容+後設資料
                          updateNode(outputNodeId, { 
                              content: result,
                              status: 'completed',
                              data: { imageMetadata: metadata }
                          });
                                    
                          // 5. 標記工具節點完成
                          updateNode(nodeId, { status: 'completed' });
                      } else {
                          console.error(`[Upscale] API返回失敗,result為空`);
                          // API失敗,更新輸出節點為error
                          updateNode(outputNodeId, { status: 'error' });
                          updateNode(nodeId, { status: 'error' });
                      }
                  }
              }
          }
          else if (node.type === 'bp') {
              // BP節點：內建智慧體+模板，執行圖片生成
              const bpTemplate = node.data?.bpTemplate;
              const bpInputs = node.data?.bpInputs || {};
              const inputImages = inputs.images;
              
              if (!bpTemplate) {
                  updateNode(nodeId, { status: 'error' });
                  console.error('BP節點執行失敗：無模板配置');
              } else {
                  try {
                      const bpFields = bpTemplate.bpFields || [];
                      const inputFields = bpFields.filter(f => f.type === 'input');
                      const agentFields = bpFields.filter(f => f.type === 'agent');
                      
                      console.log('[BP節點] 原始輸入:', bpInputs);
                      console.log('[BP節點] 欄位配置:', bpFields);
                      console.log('[BP節點] Input欄位:', inputFields.map(f => f.name));
                      console.log('[BP節點] Agent欄位:', agentFields.map(f => f.name));
                      
                      // 1. 收集使用者輸入值（input欄位）
                      const userInputValues: Record<string, string> = {};
                      for (const field of inputFields) {
                          // input欄位從bpInputs中取值（可以是field.id或field.name）
                          userInputValues[field.name] = bpInputs[field.id] || bpInputs[field.name] || '';
                          console.log(`[BP節點] Input ${field.name} = "${userInputValues[field.name]}"`);
                      }
                      
                      // 2. 按順序執行智慧體欄位（agent欄位）
                      const agentResults: Record<string, string> = {};
                      
                      for (const field of agentFields) {
                          if (field.agentConfig) {
                              // 準備agent的instruction：替換其中的變數
                              let instruction = field.agentConfig.instruction;
                              
                              // 替換 /inputName 為使用者輸入值
                              for (const [name, value] of Object.entries(userInputValues)) {
                                  instruction = instruction.split(`/${name}`).join(value);
                              }
                              
                              // 替換 {agentName} 為已執行的agent結果
                              for (const [name, result] of Object.entries(agentResults)) {
                                  instruction = instruction.split(`{${name}}`).join(result);
                              }
                              
                              console.log(`[BP節點] 執行Agent ${field.name}, instruction:`, instruction.slice(0, 200));
                              
                              // 呼叫LLM執行agent
                              try {
                                  const agentResult = await generateAdvancedLLM(
                                      instruction, // instruction作為user prompt
                                      'You are a creative assistant. Generate content based on the given instruction. Output ONLY the requested content, no explanations.',
                                      inputImages.length > 0 ? [inputImages[0]] : undefined
                                  );
                                  agentResults[field.name] = agentResult;
                                  console.log(`[BP節點] Agent ${field.name} 返回:`, agentResult.slice(0, 100));
                              } catch (agentErr) {
                                  console.error(`[BP節點] Agent ${field.name} 執行失敗:`, agentErr);
                                  agentResults[field.name] = `[Agent錯誤: ${agentErr}]`;
                              }
                          }
                      }
                      
                      // 3. 替換最終模板中的所有變數
                      let finalPrompt = bpTemplate.prompt;
                      console.log('[BP節點] 原始模板:', finalPrompt);
                      
                      // 替換 /inputName 為使用者輸入值
                      for (const [name, value] of Object.entries(userInputValues)) {
                          const beforeReplace = finalPrompt;
                          finalPrompt = finalPrompt.split(`/${name}`).join(value);
                          if (beforeReplace !== finalPrompt) {
                              console.log(`[BP節點] 替換 /${name} -> ${value.slice(0, 50)}`);
                          }
                      }
                      
                      // 替換 {agentName} 為agent結果
                      for (const [name, result] of Object.entries(agentResults)) {
                          const beforeReplace = finalPrompt;
                          finalPrompt = finalPrompt.split(`{${name}}`).join(result);
                          if (beforeReplace !== finalPrompt) {
                              console.log(`[BP節點] 替換 {${name}} -> ${result.slice(0, 50)}`);
                          }
                      }
                      
                      console.log('[BP節點] 最終提示詞:', finalPrompt.slice(0, 300));
                      
                      // 4. 呼叫圖片生成API
                      const settings = node.data?.settings || {};
                      const aspectRatio = settings.aspectRatio || 'AUTO';
                      const resolution = settings.resolution || '2K';
                      
                      let result: string | null = null;
                      if (inputImages.length > 0) {
                          // 有輸入圖片 = 圖生圖
                          let config: GenerationConfig | undefined = undefined;
                          if (aspectRatio === 'AUTO') {
                              // AUTO 模式：只傳 resolution（如果不是預設值）
                              if (resolution !== 'AUTO' && resolution !== '1K') {
                                  config = { resolution: resolution as '1K' | '2K' | '4K' };
                              }
                          } else {
                              config = { aspectRatio, resolution: resolution as '1K' | '2K' | '4K' };
                          }
                          console.log('[BP節點] 呼叫圖生圖 API, 配置:', { aspectRatio, resolution, config });
                          result = await editCreativeImage(inputImages, finalPrompt, config, signal);
                      } else {
                          // 無輸入圖片 = 文生圖
                          const config: GenerationConfig = {
                              aspectRatio: aspectRatio !== 'AUTO' ? aspectRatio : '1:1',
                              resolution: resolution as '1K' | '2K' | '4K'
                          };
                          console.log('[BP節點] 呼叫文生圖 API, 配置:', config);
                          result = await generateCreativeImage(finalPrompt, config, signal);
                      }
                      
                      console.log('[BP節點] API返回結果:', result ? `有圖片 (${result.slice(0,50)}...)` : 'null');
                      
                      if (!signal.aborted) {
                          // 檢查是否有下游連線
                          const hasDownstream = connectionsRef.current.some(c => c.fromNode === nodeId);
                          console.log('[BP節點] 有下游連線:', hasDownstream);
                          
                          if (hasDownstream) {
                              // 有下游連線：結果存到 data.output，保持節點原貌
                              console.log('[BP節點] 有下游，結果存到 data.output');
                              updateNode(nodeId, {
                                  data: { ...node.data, output: result || '' },
                                  status: result ? 'completed' : 'error'
                              });
                          } else {
                              // 無下游連線：結果存到 content，顯示圖片
                              console.log('[BP節點] 無下游，結果存到 content');
                              updateNode(nodeId, {
                                  content: result || '',
                                  status: result ? 'completed' : 'error'
                              });
                          }
                          
                          // 儲存畫布
                          saveCurrentCanvas();
                          
                          // 同步到桌面
                          if (result && onImageGenerated) {
                              onImageGenerated(result, finalPrompt, currentCanvasId || undefined, canvasName);
                          }
                      }
                  } catch (err) {
                      console.error('BP節點執行失敗:', err);
                      updateNode(nodeId, { status: 'error' });
                  }
              }
          }

      } catch (e) {
          if ((e as Error).name !== 'AbortError') {
              console.error(e);
              updateNode(nodeId, { status: 'error' });
          }
      } finally {
          // Clean up abort controller
          abortControllersRef.current.delete(nodeId);
          // 🔓 解鎖：移除執行標記
          executingNodesRef.current.delete(nodeId);
          console.log(`[🔓執行鎖] 節點 ${nodeId.slice(0,8)} 已解鎖`);
      }
  };
  
  // 將 handleExecuteNode 賦值給 ref，供 recoverVideoTasks 使用
  useEffect(() => {
      executeNodeRef.current = handleExecuteNode;
  }, []);

  // Function to cancel/stop a running node execution
  const handleStopNode = (nodeId: string) => {
      const controller = abortControllersRef.current.get(nodeId);
      if (controller) {
          controller.abort();
          abortControllersRef.current.delete(nodeId);
          updateNode(nodeId, { status: 'idle' });
      }
  };

  const handleDragOver = (e: React.DragEvent) => {
    console.log('[Canvas] DragOver triggered');
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    
    console.log('[Canvas] Drop event, types:', Array.from(e.dataTransfer.types));
    
    // 嘗試從 dataTransfer 獲取
    let type = e.dataTransfer.getData('nodeType') as NodeType;
    console.log('[Canvas] nodeType from dataTransfer:', type);
    
    // 備用：從 text/plain 獲取
    if (!type) {
      type = e.dataTransfer.getData('text/plain') as NodeType;
      console.log('[Canvas] nodeType from text/plain:', type);
    }
    
    // 備用：從全域性狀態獲取
    if (!type && (window as any).__draggingNodeType) {
      type = (window as any).__draggingNodeType as NodeType;
      console.log('[Canvas] nodeType from window:', type);
      (window as any).__draggingNodeType = null;
    }
    
    // Calculate drop position relative to canvas
    const container = containerRef.current;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const x = (e.clientX - rect.left - canvasOffset.x) / scale - 150; // Center node roughly
    const y = (e.clientY - rect.top - canvasOffset.y) / scale - 100;

    if (type && ['image', 'text', 'video', 'llm', 'idea', 'relay', 'edit', 'remove-bg', 'upscale', 'resize', 'bp'].includes(type)) {
        console.log('[Drop] 建立節點:', type, '位置:', x, y);
        addNode(type, '', { x, y });
        return;
    }

    // 2. Handle File Drop (OS Files)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        Array.from(e.dataTransfer.files).forEach((item, index) => {
            const file = item as File;
            const offsetX = x + (index * 20); // Stagger multiple files slightly
            const offsetY = y + (index * 20);

            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    if (ev.target?.result) {
                        addNode('image', ev.target.result as string, { x: offsetX, y: offsetY });
                    }
                };
                reader.readAsDataURL(file);
            } else if (file.type.startsWith('video/')) {
                 const reader = new FileReader();
                reader.onload = (ev) => {
                    if (ev.target?.result) {
                        addNode('video', ev.target.result as string, { x: offsetX, y: offsetY });
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }
  };

  // --- INTERACTION HANDLERS ---

  const onMouseDownCanvas = (e: React.MouseEvent) => {
      // Logic:
      // Space + Left Click = Pan Canvas
      // Ctrl/Meta + Left Click = Box Selection
      // Middle Click = Pan
      // Left Click on BG (no space) = Deselect All only
      
      if (e.button === 0) {
          if (e.ctrlKey || e.metaKey) {
             // START SELECTION BOX
             setSelectionBox({ start: { x: e.clientX, y: e.clientY }, current: { x: e.clientX, y: e.clientY } });
          } else if (isSpacePressed) {
             // Space + Left Click = Pan Canvas
             setIsDraggingCanvas(true);
             setDragStart({ x: e.clientX - canvasOffset.x, y: e.clientY - canvasOffset.y });
          } else {
             // Just Left Click = Deselect only (no pan)
             setSelectedNodeIds(new Set());
             setSelectedConnectionId(null);
          }
      } else if (e.button === 1) {
          // Middle click pan
          setIsDraggingCanvas(true);
          setDragStart({ x: e.clientX - canvasOffset.x, y: e.clientY - canvasOffset.y });
      }
  };

  const onMouseMove = (e: React.MouseEvent) => {
      const clientX = e.clientX;
      const clientY = e.clientY;
      
      // 1. Pan Canvas - 使用 RAF 批次更新
      if (isDraggingCanvas) {
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
          rafRef.current = requestAnimationFrame(() => {
              setCanvasOffset({
                  x: clientX - dragStart.x,
                  y: clientY - dragStart.y
              });
          });
          return;
      }

     // 2. Dragging Nodes - 使用 RAF 批次更新
      if (draggingNodeId && isDragOperation) {
          // 🔥 新功能：拖拽節點時按住空格可同時平移畫布
          if (isSpacePressed) {
              // 計算滑鼠移動增量（螢幕空間）
              const mouseDeltaX = clientX - lastMousePosRef.current.x;
              const mouseDeltaY = clientY - lastMousePosRef.current.y;
              
              // 初始化時跳過（避免第一次大跳躍）
              if (lastMousePosRef.current.x !== 0 || lastMousePosRef.current.y !== 0) {
                  // 平移畫布
                  setCanvasOffset(prev => ({
                      x: prev.x + mouseDeltaX,
                      y: prev.y + mouseDeltaY
                  }));
                  
                  // 🔧 最佳化：直接更新 ref，避免 setState 導致的重渲染和卡頓
                  dragStartMousePosRef.current = {
                      x: dragStartMousePosRef.current.x + mouseDeltaX,
                      y: dragStartMousePosRef.current.y + mouseDeltaY
                  };
              }
              
              // 更新上次滑鼠位置
              lastMousePosRef.current = { x: clientX, y: clientY };
          } else {
              // 未按空格時重置上次位置
              lastMousePosRef.current = { x: 0, y: 0 };
          }
          
          // 使用 ref 計算 delta，避免閉包問題
          const deltaX = (clientX - dragStartMousePosRef.current.x) / scale;
          const deltaY = (clientY - dragStartMousePosRef.current.y) / scale;
          
          // 儲存當前 delta
          dragDeltaRef.current = { x: deltaX, y: deltaY };
          
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
          rafRef.current = requestAnimationFrame(() => {
              const delta = dragDeltaRef.current;
              const newNodes = nodesRef.current.map(node => {
                  if (selectedNodeIds.has(node.id)) {
                      const initialPos = initialNodePositionsRef.current.get(node.id); // 使用 ref 獲取最新值
                      if (initialPos) {
                          return {
                              ...node,
                              x: initialPos.x + delta.x,
                              y: initialPos.y + delta.y
                          };
                      }
                  }
                  return node;
              });
              // 同時更新 state 和 ref，確保一致性
              nodesRef.current = newNodes;
              setNodes(newNodes);
          });
          return;
      }

      // 3. Selection Box
      if (selectionBox) {
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
          rafRef.current = requestAnimationFrame(() => {
              setSelectionBox(prev => prev ? { ...prev, current: { x: clientX, y: clientY } } : null);
          });
          return;
      }

      // 4. Linking - 使用 RAF 最佳化
      if (linkingState.active) {
          const container = containerRef.current;
          if (container) {
               const rect = container.getBoundingClientRect();
               const newPos = {
                   x: (clientX - rect.left - canvasOffset.x) / scale,
                   y: (clientY - rect.top - canvasOffset.y) / scale
               };
               if (rafRef.current) cancelAnimationFrame(rafRef.current);
               rafRef.current = requestAnimationFrame(() => {
                   setLinkingState(prev => ({
                       ...prev,
                       currPos: newPos
                   }));
               });
          }
      }
  };

  const onMouseUp = (e: React.MouseEvent) => {
      // 清理 RAF
      if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
      }
      
      // 記錄是否剛完成拖拽操作
      const wasDragging = isDragOperation && draggingNodeId;
      
      setIsDraggingCanvas(false);
      setDraggingNodeId(null);
      setIsDragOperation(false);
      setLinkingState(prev => ({ ...prev, active: false, fromNode: null }));

      // 拖拽結束後標記未儲存
      if (wasDragging) {
          setHasUnsavedChanges(true);
          console.log('[拖拽] 拖拽結束，已標記未儲存');
      }

      // Resolve Selection Box
      if (selectionBox) {
          const container = containerRef.current;
          if (container) {
              const rect = container.getBoundingClientRect();
              
              // Convert box to canvas space
              const startX = (selectionBox.start.x - rect.left - canvasOffset.x) / scale;
              const startY = (selectionBox.start.y - rect.top - canvasOffset.y) / scale;
              const curX = (selectionBox.current.x - rect.left - canvasOffset.x) / scale;
              const curY = (selectionBox.current.y - rect.top - canvasOffset.y) / scale;

              const minX = Math.min(startX, curX);
              const maxX = Math.max(startX, curX);
              const minY = Math.min(startY, curY);
              const maxY = Math.max(startY, curY);

              // Standard box select behavior: Select what is inside
              const newSelection = new Set<string>();
              // Note: If you want to hold Shift to add to selection, handle e.shiftKey here. 
              // For now, implementing standard replacement selection.
              
              nodes.forEach(node => {
                  const nodeCenterX = node.x + node.width / 2;
                  const nodeCenterY = node.y + node.height / 2;
                  if (nodeCenterX >= minX && nodeCenterX <= maxX && nodeCenterY >= minY && nodeCenterY <= maxY) {
                      newSelection.add(node.id);
                  }
              });
              setSelectedNodeIds(newSelection);
          }
          setSelectionBox(null);
      }
  };

  const handleNodeDragStart = (e: React.MouseEvent, id: string) => {
      if (e.button !== 0) return; // Only left click
      e.stopPropagation();
      
      const newSelection = new Set(selectedNodeIds);
      if (!newSelection.has(id)) {
          if (!e.shiftKey) newSelection.clear();
          newSelection.add(id);
          setSelectedNodeIds(newSelection);
      }
      
      setDraggingNodeId(id);
      setIsDragOperation(true);
      setDragStartMousePos({ x: e.clientX, y: e.clientY });
      dragStartMousePosRef.current = { x: e.clientX, y: e.clientY }; // 同步更新 ref
      
      // Snapshot positions - 使用 nodesRef 確保獲取最新的節點位置
      const positions = new Map<string, Vec2>();
      const currentNodes = nodesRef.current.length > 0 ? nodesRef.current : nodes;
      currentNodes.forEach(n => {
          if (newSelection.has(n.id)) {
              positions.set(n.id, { x: n.x, y: n.y });
          }
      });
      setInitialNodePositions(positions);
      initialNodePositionsRef.current = positions; // 同步更新 ref
  };

  const handleStartConnection = (nodeId: string, portType: 'in' | 'out', pos: Vec2) => {
     if (portType === 'out') {
         setLinkingState({
             active: true,
             fromNode: nodeId,
             startPos: pos, 
             currPos: { x: (pos.x - canvasOffset.x) / scale, y: (pos.y - canvasOffset.y) / scale } 
         });
     }
  };

  const handleEndConnection = (targetNodeId: string) => {
      if (linkingState.active && linkingState.fromNode && linkingState.fromNode !== targetNodeId) {
          const exists = connections.some(c => c.fromNode === linkingState.fromNode && c.toNode === targetNodeId);
          if (!exists) {
              setConnections(prev => [...prev, {
                  id: uuid(),
                  fromNode: linkingState.fromNode!,
                  toNode: targetNodeId
              }]);
              setHasUnsavedChanges(true); // 標記未儲存
          }
      }
  };

  // 處理工具節點建立
  const handleCreateToolNode = (sourceNodeId: string, toolType: NodeType, position: { x: number, y: number }) => {
      // 為擴圖工具預設 prompt
      let presetData = {};
      if (toolType === 'edit') {
          presetData = { prompt: "Extend the image naturally, maintaining style and coherence" };
      }
      
      const newNode = addNode(toolType, '', position, undefined, presetData);
      
      // 自動建立連線
      setConnections(prev => [...prev, {
          id: uuid(),
          fromNode: sourceNodeId,
          toNode: newNode.id
      }]);
      setHasUnsavedChanges(true); // 標記未儲存
  };

  // 處理影片幀提取
  const handleExtractFrame = async (nodeId: string, position: 'first' | 'last') => {
      const node = nodes.find(n => n.id === nodeId);
      if (!node || !node.content) {
          console.warn('[ExtractFrame] 節點無內容:', nodeId);
          return;
      }

      console.log('[ExtractFrame] 開始提取幀:', { nodeId, position, content: node.content.substring(0, 100) });

      try {
          // 建立影片元素來提取幀
          const video = document.createElement('video');
          video.crossOrigin = 'anonymous';
          
          // 處理影片 URL
          let videoUrl = node.content;
          if (videoUrl.startsWith('/files/')) {
              videoUrl = `http://localhost:8765${videoUrl}`;
          }
          
          // 等待影片載入
          await new Promise<void>((resolve, reject) => {
              video.onloadedmetadata = () => {
                  console.log('[ExtractFrame] 影片後設資料載入完成:', { duration: video.duration, width: video.videoWidth, height: video.videoHeight });
                  resolve();
              };
              video.onerror = (e) => {
                  console.error('[ExtractFrame] 影片載入失敗:', e);
                  reject(new Error('影片載入失敗'));
              };
              video.src = videoUrl;
              video.load();
          });

          // 跳轉到指定幀位置
          const targetTime = position === 'first' ? 0 : Math.max(0, video.duration - 0.1);
          await new Promise<void>((resolve) => {
              video.onseeked = () => {
                  console.log('[ExtractFrame] 跳轉完成:', targetTime);
                  resolve();
              };
              video.currentTime = targetTime;
          });

          // 使用 canvas 提取幀
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('無法建立 canvas context');
          
          ctx.drawImage(video, 0, 0);
          const frameDataUrl = canvas.toDataURL('image/png');
          console.log('[ExtractFrame] 幀提取成功, 大小:', frameDataUrl.length);

          // 儲存到 output 目錄
          const { saveToOutput } = await import('@/services/api/files');
          const result = await saveToOutput(frameDataUrl, `frame_${Date.now()}.png`);
          if (!result.success || !result.data) {
              throw new Error(result.error || '儲存幀失敗');
          }
          const savedPath = result.data.url;
          console.log('[ExtractFrame] 儲存成功:', savedPath);

          // 建立新的圖片節點
          const sourceNode = nodes.find(n => n.id === nodeId);
          const newNodeX = (sourceNode?.x || 0) + (sourceNode?.width || 300) + 50;
          const newNodeY = sourceNode?.y || 0;

          const newNode = addNode('image', savedPath, { x: newNodeX, y: newNodeY });
          
          // 建立連線
          setConnections(prev => [...prev, {
              id: uuid(),
              fromNode: nodeId,
              toNode: newNode.id
          }]);
          setHasUnsavedChanges(true);

          console.log('[ExtractFrame] 完成，新節點:', newNode.id);
      } catch (error) {
          console.error('[ExtractFrame] 提取幀失敗:', error);
      }
  };

  // --- FLOATING GENERATOR HANDLER ---
  const handleGenerate = async (type: NodeType, prompt: string, config: GenerationConfig, files?: File[]) => {
      console.log('[FloatingInput] 開始生成:', { type, prompt, config });
      setIsGenerating(true);
      
      let base64Files: string[] = [];
      if (files && files.length > 0) {
          const promises = files.map(file => new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = (e) => resolve(e.target?.result as string);
              reader.readAsDataURL(file);
          }));
          base64Files = await Promise.all(promises);
      }

      const newNode = addNode(type, '', undefined, undefined, { 
          prompt: prompt,
          settings: config
      });
      console.log('[FloatingInput] 節點已建立:', newNode.id);
      
      updateNode(newNode.id, { status: 'running' });

      try {
          if (type === 'image') {
               const result = await generateCreativeImage(prompt, config);
               updateNode(newNode.id, { content: result || '', status: result ? 'completed' : 'error' });
               // 同步到桌面
               if (result && onImageGenerated) {
                   onImageGenerated(result, prompt, currentCanvasId || undefined, canvasName);
               }
          } 
          else if (type === 'edit') {
               const result = await editCreativeImage(base64Files, prompt, config);
               updateNode(newNode.id, { content: result || '', status: result ? 'completed' : 'error' });
               // 同步到桌面
               if (result && onImageGenerated) {
                   onImageGenerated(result, prompt, currentCanvasId || undefined, canvasName);
               }
          }
      } catch(e) {
          console.error('[FloatingInput] 生成失敗:', e);
          updateNode(newNode.id, { status: 'error' });
      } finally {
          setIsGenerating(false);
      }
  };

  // --- CONTEXT MENU ---
  const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const contextOptions = [
      { 
          label: "Save as Preset", 
          icon: <Icons.Layers />, 
          action: () => {
              if (selectedNodeIds.size > 0) {
                  setNodesForPreset(nodes.filter(n => selectedNodeIds.has(n.id)));
                  setShowPresetModal(true);
              }
          }
      },
      {
          label: "Delete Selection",
          icon: <Icons.Close />,
          action: deleteSelection,
          danger: true
      }
  ];

  return (
    <div 
      className="w-full h-full bg-[#0a0a0f] text-white overflow-hidden relative" 
      onContextMenu={handleContextMenu}
    >

      <Sidebar 
          onDragStart={(type) => { /* HTML5 drag handled in drop */ }}
          onAdd={addNode}
          userPresets={userPresets}
          onAddPreset={(pid) => {
             const p = userPresets.find(pr => pr.id === pid);
             if (p) setInstantiatingPreset(p);
          }}
          onDeletePreset={(pid) => setUserPresets(prev => prev.filter(p => p.id !== pid))}
          onHome={handleResetView}
          onOpenSettings={() => setShowApiSettings(true)}
          isApiConfigured={apiConfigured}
          canvasList={canvasList}
          currentCanvasId={currentCanvasId}
          canvasName={canvasName}
          isCanvasLoading={isCanvasLoading}
          onCreateCanvas={createNewCanvas}
          onLoadCanvas={loadCanvas}
          onDeleteCanvas={deleteCanvasById}
          onRenameCanvas={renameCanvas}
          creativeIdeas={creativeIdeas}
          onManualSave={handleManualSave}
          autoSaveEnabled={autoSaveEnabled}
          hasUnsavedChanges={hasUnsavedChanges}
          onApplyCreativeIdea={(idea) => {
            // 應用創意庫到畫布
            const baseX = -canvasOffset.x / scale + 200;
            const baseY = -canvasOffset.y / scale + 100;
            
            setHasUnsavedChanges(true); // 標記未儲存
            
            if (idea.isWorkflow && idea.workflowNodes && idea.workflowConnections) {
              // 工作流型別：新增整個工作流節點
              const offsetX = canvasOffset.x + 200;
              const offsetY = canvasOffset.y + 100;
              const newNodes = idea.workflowNodes.map(n => ({
                ...n,
                id: `${n.id}_${Date.now()}`,
                x: n.x + offsetX,
                y: n.y + offsetY,
              }));
              const idMapping = new Map(idea.workflowNodes.map((n, i) => [n.id, newNodes[i].id]));
              const newConns = idea.workflowConnections.map(c => ({
                ...c,
                id: `${c.id}_${Date.now()}`,
                fromNode: idMapping.get(c.fromNode) || c.fromNode,
                toNode: idMapping.get(c.toNode) || c.toNode,
              }));
              setNodes(prev => [...prev, ...newNodes] as CanvasNode[]);
              setConnections(prev => [...prev, ...newConns]);
            } else if (idea.isBP && idea.bpFields) {
              // BP模式：建立單個BP節點（內建智慧體+模板，直接輸出圖片）
              const bpNodeId = `bp_${Date.now()}`;
              
              // BP節點：包含輸入欄位和模板，執行後直接顯示圖片
              const bpNode: CanvasNode = {
                id: bpNodeId,
                type: 'bp' as NodeType,
                title: idea.title,
                content: '', // 執行後存放圖片
                x: baseX,
                y: baseY,
                width: 320,
                height: 300,
                data: {
                  bpTemplate: {
                    id: idea.id,
                    title: idea.title,
                    prompt: idea.prompt,
                    bpFields: idea.bpFields,
                    imageUrl: idea.imageUrl,
                  },
                  bpInputs: {}, // 使用者輸入值
                  settings: {
                    aspectRatio: idea.suggestedAspectRatio || '1:1',
                    resolution: idea.suggestedResolution || '2K',
                  },
                },
              };
              
              setNodes(prev => [...prev, bpNode]);
              // 不建立結果節點，BP節點本身就是輸出
            } else {
              // 普通創意：只建立創意節點，不帶影象節點（對齊BP模式）
              const ideaId = `idea_${Date.now()}`;
              
              // Idea節點：包含提示詞和設定
              const ideaNode: CanvasNode = {
                id: ideaId,
                type: 'idea' as NodeType,
                title: idea.title,
                content: idea.prompt,
                x: baseX,
                y: baseY,
                width: 280,
                height: 280,
                data: {
                  settings: {
                    aspectRatio: idea.suggestedAspectRatio || '1:1',
                    resolution: idea.suggestedResolution || '2K',
                  },
                },
              };
              
              setNodes(prev => [...prev, ideaNode]);
              // 不建立Image節點，不建立連線
            }
          }}
      />
      
      {/* 畫布名稱標識 - 獨立模組 */}
      <CanvasNameBadge 
        canvasName={canvasName}
        isLoading={isCanvasLoading}
        hasUnsavedChanges={hasUnsavedChanges}
      />
      
      <div
        ref={containerRef}
        className={`w-full h-full relative ${isSpacePressed ? 'cursor-grab' : 'cursor-default'} ${isDraggingCanvas ? '!cursor-grabbing' : ''}`}
        onMouseDown={onMouseDownCanvas}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      > 
        {/* Background Grid */}
        <div 
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
                backgroundImage: 'radial-gradient(circle, #444 1px, transparent 1px)',
                backgroundSize: `${20 * scale}px ${20 * scale}px`,
                backgroundPosition: `${canvasOffset.x}px ${canvasOffset.y}px`
            }}
        />

        {/* Canvas Content Container */}
        <div 
            style={{ 
                transform: `translate3d(${canvasOffset.x}px, ${canvasOffset.y}px, 0) scale(${scale})`,
                transformOrigin: '0 0',
                width: '100%',
                height: '100%',
                willChange: 'transform',
                backfaceVisibility: 'hidden',
                pointerEvents: 'none'
            } as React.CSSProperties}
            className="absolute top-0 left-0"
        >
            {/* Connections */}
            <svg className="absolute top-0 left-0 w-full h-full overflow-visible pointer-events-none z-0">
                {/* 發光濾鏡定義 - 黑白光感 */}
                <defs>
                    <filter id="glow-white" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                        <feMerge>
                            <feMergeNode in="coloredBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                    </filter>
                    <filter id="glow-selected" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                        <feMerge>
                            <feMergeNode in="coloredBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                    </filter>
                    {/* 黑白漸變 */}
                    <linearGradient id="grad-mono" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#666" stopOpacity="0.4"/>
                        <stop offset="30%" stopColor="#fff" stopOpacity="0.9"/>
                        <stop offset="70%" stopColor="#fff" stopOpacity="0.9"/>
                        <stop offset="100%" stopColor="#666" stopOpacity="0.4"/>
                    </linearGradient>
                    <linearGradient id="grad-selected" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#888" stopOpacity="0.5"/>
                        <stop offset="50%" stopColor="#fff" stopOpacity="1"/>
                        <stop offset="100%" stopColor="#888" stopOpacity="0.5"/>
                    </linearGradient>
                </defs>
                {connections.map(conn => {
                    // 🔧 使用 nodesRef 獲取最新位置，確保拖拽時連線實時跟隨
                    const from = nodesRef.current.find(n => n.id === conn.fromNode);
                    const to = nodesRef.current.find(n => n.id === conn.toNode);
                    if (!from || !to) return null;

                    const startX = from.x + from.width;
                    const startY = from.y + from.height / 2;
                    const endX = to.x;
                    const endY = to.y + to.height / 2;
                    
                    const isSelected = selectedConnectionId === conn.id;
                    
                    // 計算水平和垂直距離
                    const dx = endX - startX;
                    const dy = endY - startY;
                    const distance = Math.abs(dx);
                    const verticalDistance = Math.abs(dy);
                    
                    // 最小控制點偏移，確保連線始終可見
                    const minControlOffset = 50;
                    
                    let ctrl1X, ctrl1Y, ctrl2X, ctrl2Y;
                    
                    if (dx >= 0) {
                        // 正常方向：從左到右
                        // 控制點偏移：確保曲線可見，但不超過實際距離的一半
                        const controlOffset = Math.min(Math.max(distance / 3, minControlOffset), distance / 2 + 20);
                        ctrl1X = startX + controlOffset;
                        ctrl1Y = startY;
                        ctrl2X = endX - controlOffset;
                        ctrl2Y = endY;
                        
                        // 特殊處理：當水平距離很小時（節點靠近），使用直線而非曲線
                        if (distance < 100) {
                            ctrl1X = startX + distance / 2;
                            ctrl2X = startX + distance / 2;
                        }
                    } else {
                        // 反向連線：目標在源節點左側，需要曲線繞行
                        // 使用更大的控制點偏移來建立可見的曲線
                        const controlOffset = Math.max(distance / 2, minControlOffset * 1.5);
                        ctrl1X = startX + controlOffset;
                        ctrl1Y = startY + (verticalDistance > 50 ? 0 : (endY > startY ? 50 : -50)); // 垂直偏移避免重疊
                        ctrl2X = endX - controlOffset;
                        ctrl2Y = endY + (verticalDistance > 50 ? 0 : (endY > startY ? -50 : 50));
                    }
                    
                    // 三次貝塞爾曲線路徑
                    const pathD = `M ${startX} ${startY} C ${ctrl1X} ${ctrl1Y}, ${ctrl2X} ${ctrl2Y}, ${endX} ${endY}`;

                    return (
                        <g key={conn.id} onClick={() => setSelectedConnectionId(conn.id)} className="pointer-events-auto cursor-pointer group">
                             {/* 點選區域 */}
                             <path 
                                d={pathD}
                                stroke="transparent"
                                strokeWidth="20"
                                fill="none"
                            />
                            {/* 外層光暈 - 使用純白色 */}
                            <path 
                                d={pathD}
                                stroke={isSelected ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)'}
                                strokeWidth={isSelected ? 8 : 5}
                                fill="none"
                                filter="url(#glow-white)"
                                strokeLinecap="round"
                            />
                            {/* 主線條 - 使用純白色 */}
                            <path 
                                d={pathD}
                                stroke={isSelected ? '#ffffff' : 'rgba(255,255,255,0.9)'}
                                strokeWidth={isSelected ? 3 : 2}
                                fill="none"
                                strokeLinecap="round"
                            />
                            {/* 端點光球 */}
                            <circle 
                                cx={startX} 
                                cy={startY} 
                                r={isSelected ? 5 : 4} 
                                fill="#ffffff"
                                filter="url(#glow-white)"
                            />
                            <circle 
                                cx={endX} 
                                cy={endY} 
                                r={isSelected ? 5 : 4} 
                                fill="#ffffff"
                                filter="url(#glow-white)"
                            />
                        </g>
                    );
                })}
                
                {/* Active Link Line */}
                {linkingState.active && linkingState.fromNode && (() => {
                     // 🔧 使用 nodesRef 獲取最新位置
                     const fromNode = nodesRef.current.find(n => n.id === linkingState.fromNode);
                     if (!fromNode) return null;
                     const startX = fromNode.x + fromNode.width; 
                     const startY = fromNode.y + fromNode.height / 2;
                     const endX = linkingState.currPos.x;
                     const endY = linkingState.currPos.y;
                     
                     // 計算水平和垂直距離
                     const dx = endX - startX;
                     const dy = endY - startY;
                     const distance = Math.abs(dx);
                     const verticalDistance = Math.abs(dy);
                     
                     // 最小控制點偏移
                     const minControlOffset = 50;
                     
                     let ctrl1X, ctrl1Y, ctrl2X, ctrl2Y;
                     
                     if (dx >= 0) {
                         const controlOffset = Math.min(Math.max(distance / 3, minControlOffset), distance / 2 + 20);
                         ctrl1X = startX + controlOffset;
                         ctrl1Y = startY;
                         ctrl2X = endX - controlOffset;
                         ctrl2Y = endY;
                         
                         // 特殊處理：當水平距離很小時，使用直線
                         if (distance < 100) {
                             ctrl1X = startX + distance / 2;
                             ctrl2X = startX + distance / 2;
                         }
                     } else {
                         const controlOffset = Math.max(distance / 2, minControlOffset * 1.5);
                         ctrl1X = startX + controlOffset;
                         ctrl1Y = startY + (verticalDistance > 50 ? 0 : (endY > startY ? 50 : -50));
                         ctrl2X = endX - controlOffset;
                         ctrl2Y = endY + (verticalDistance > 50 ? 0 : (endY > startY ? -50 : 50));
                     }
                     
                     return (
                        <>
                            <path 
                                d={`M ${startX} ${startY} C ${ctrl1X} ${ctrl1Y}, ${ctrl2X} ${ctrl2Y}, ${endX} ${endY}`}
                                stroke="rgba(255,255,255,0.4)"
                                strokeWidth="4"
                                fill="none"
                                filter="url(#glow-white)"
                                strokeLinecap="round"
                            />
                            <path 
                                d={`M ${startX} ${startY} C ${ctrl1X} ${ctrl1Y}, ${ctrl2X} ${ctrl2Y}, ${endX} ${endY}`}
                                stroke="url(#grad-mono)"
                                strokeWidth="1.5"
                                fill="none"
                                strokeLinecap="round"
                                strokeDasharray="6,4"
                            />
                            <circle cx={startX} cy={startY} r="3" fill="rgba(255,255,255,0.8)" filter="url(#glow-white)" />
                            <circle cx={endX} cy={endY} r="3" fill="rgba(255,255,255,0.6)" filter="url(#glow-white)" />
                        </>
                     )
                })()}
            </svg>

            {/* Nodes */}
            {nodes.map(node => (
                <CanvasNodeItem 
                    key={node.id}
                    node={node}
                    isSelected={selectedNodeIds.has(node.id)}
                    scale={scale}
                    effectiveColor={node.type === 'relay' ? 'stroke-' + resolveEffectiveType(node.id).replace('text', 'emerald').replace('image', 'blue').replace('llm', 'purple') + '-400' : undefined}
                    hasDownstream={connections.some(c => c.fromNode === node.id)}
                    onSelect={(id, multi) => {
                        const newSet = new Set(multi ? selectedNodeIds : []);
                        newSet.add(id);
                        setSelectedNodeIds(newSet);
                    }}
                    onDragStart={handleNodeDragStart}
                    onUpdate={updateNode}
                    onDelete={(id) => setNodes(prev => prev.filter(n => n.id !== id))}
                    onExecute={handleExecuteNode}
                    onStop={handleStopNode}
                    onDownload={async (id) => {
                        const n = nodes.find(x => x.id === id);
                        if (!n || !n.content) {
                            console.warn('[Download] 節點無內容:', id);
                            return;
                        }
                        
                        // 根據內容型別判斷副檔名
                        const isVideo = n.content.startsWith('data:video') || n.content.includes('.mp4') || n.type === 'video';
                        const ext = isVideo ? 'mp4' : 'png';
                        const filename = `pebbling-${n.id}.${ext}`;
                        const content = n.content;
                        
                        // 如果是 base64 資料，直接下載
                        if (content.startsWith('data:')) {
                            const link = document.createElement('a');
                            link.href = content;
                            link.download = filename;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            console.log('[Download] Base64 下載成功:', filename);
                            return;
                        }
                        
                        // 處理 URL 路徑（/files/、/api/、http://、https://）
                        try {
                            let urlToFetch = content;
                            
                            // 相對路徑轉絕對路徑
                            if (content.startsWith('/files/') || content.startsWith('/api/')) {
                                urlToFetch = `http://localhost:8765${content}`;
                            }
                            
                            console.log('[Download] 正在下載:', urlToFetch);
                            const response = await fetch(urlToFetch);
                            
                            if (!response.ok) {
                                throw new Error(`HTTP ${response.status}`);
                            }
                            
                            const blob = await response.blob();
                            const blobUrl = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = blobUrl;
                            link.download = filename;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            URL.revokeObjectURL(blobUrl);
                            console.log('[Download] URL 下載成功:', filename);
                        } catch (error: any) {
                            console.error('[Download] 下載失敗:', error);
                            // 降級：在新視窗開啟
                            window.open(content, '_blank');
                        }
                    }}
                    onStartConnection={(id, type, pos) => {
                        handleStartConnection(id, type, pos);
                    }}
                    onEndConnection={handleEndConnection}
                    onCreateToolNode={handleCreateToolNode}
                    onExtractFrame={handleExtractFrame}
                />
            ))}
        </div>

        {/* Selection Box Overlay */}
        {selectionBox && (
            <div 
                className="absolute border border-blue-500 bg-blue-500/20 pointer-events-none z-50"
                style={{
                    left: Math.min(selectionBox.start.x, selectionBox.current.x),
                    top: Math.min(selectionBox.start.y, selectionBox.current.y),
                    width: Math.abs(selectionBox.current.x - selectionBox.start.x),
                    height: Math.abs(selectionBox.current.y - selectionBox.start.y)
                }}
            />
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
          <ContextMenu 
            x={contextMenu.x} 
            y={contextMenu.y} 
            onClose={() => setContextMenu(null)}
            options={contextOptions}
          />
      )}

      {/* Modals */}
      {showPresetModal && (
          <PresetCreationModal 
             selectedNodes={nodesForPreset}
             onCancel={() => setShowPresetModal(false)}
             onSave={(title, desc, inputs) => {
                 const newPreset: CanvasPreset = {
                     id: uuid(),
                     title,
                     description: desc,
                     nodes: JSON.parse(JSON.stringify(nodesForPreset)), // Deep copy
                     connections: connections.filter(c => {
                         const nodeIds = new Set(nodesForPreset.map(n => n.id));
                         return nodeIds.has(c.fromNode) && nodeIds.has(c.toNode);
                     }),
                     inputs
                 };
                 setUserPresets(prev => [...prev, newPreset]);
                 setShowPresetModal(false);
             }}
          />
      )}

      {instantiatingPreset && (
          <PresetInstantiationModal 
             preset={instantiatingPreset}
             onCancel={() => setInstantiatingPreset(null)}
             onConfirm={(inputValues) => {
                 // Clone Nodes
                 const idMap = new Map<string, string>();
                 const newNodes: CanvasNode[] = [];
                 
                 // Center placement
                 const centerX = (-canvasOffset.x + window.innerWidth/2) / scale;
                 const centerY = (-canvasOffset.y + window.innerHeight/2) / scale;
                 
                 // Find centroid of preset
                 const minX = Math.min(...instantiatingPreset.nodes.map(n => n.x));
                 const minY = Math.min(...instantiatingPreset.nodes.map(n => n.y));

                 instantiatingPreset.nodes.forEach(n => {
                     const newId = uuid();
                     idMap.set(n.id, newId);
                     
                     // Apply Inputs
                     let content = n.content;
                     let prompt = n.data?.prompt;
                     let system = n.data?.systemInstruction;

                     // Check overrides
                     instantiatingPreset.inputs.forEach(inp => {
                         if (inp.nodeId === n.id) {
                             const val = inputValues[`${n.id}-${inp.field}`];
                             if (val) {
                                 if (inp.field === 'content') content = val;
                                 if (inp.field === 'prompt') prompt = val;
                                 if (inp.field === 'systemInstruction') system = val;
                             }
                         }
                     });

                     newNodes.push({
                         ...n,
                         id: newId,
                         x: n.x - minX + centerX - 200, // Offset to center
                         y: n.y - minY + centerY - 150,
                         content,
                         data: { ...n.data, prompt, systemInstruction: system },
                         status: 'idle'
                     });
                 });

                 // Clone Connections
                 const newConns = instantiatingPreset.connections.map(c => ({
                     id: uuid(),
                     fromNode: idMap.get(c.fromNode)!,
                     toNode: idMap.get(c.toNode)!
                 }));

                 setNodes(prev => [...prev, ...newNodes]);
                 setConnections(prev => [...prev, ...newConns]);
                 setInstantiatingPreset(null);
             }}
          />
      )}

    </div>
  );
};

export default PebblingCanvas;
