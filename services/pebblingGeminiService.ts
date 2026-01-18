
import { GenerationConfig } from '../types/pebblingTypes';

// T8star API 配置介面
export interface ThirdPartyApiConfig {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;           // 圖片生成模型
  chatModel: string;       // 文字分析模型
}

// 預設配置
const DEFAULT_CONFIG: ThirdPartyApiConfig = {
  enabled: true,
  baseUrl: 'https://ai.t8star.cn',
  apiKey: '',
  model: 'nano-banana-2',
  chatModel: 'gemini-2.5-pro'
};

// 獲取配置
export const getApiConfig = (): ThirdPartyApiConfig => {
  try {
    const saved = localStorage.getItem('t8star_api_config');
    if (saved) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('Failed to load API config:', e);
  }
  return DEFAULT_CONFIG;
};

// 儲存配置
export const saveApiConfig = (config: ThirdPartyApiConfig): void => {
  localStorage.setItem('t8star_api_config', JSON.stringify(config));
};

// 檢查 API Key 是否已配置
export const isApiConfigured = (): boolean => {
  const config = getApiConfig();
  return !!(config.apiKey && config.apiKey.startsWith('sk-'));
};

// 輔助函式：File 轉 base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// 輔助函式：base64 字串提取純 base64
const extractBase64 = (dataUrl: string): string => {
  return dataUrl.split(',')[1] || dataUrl;
};

// 輔助函式：獲取 MIME 型別
const getMimeType = (dataUrl: string): string => {
  const match = dataUrl.match(/^data:([^;]+);/);
  return match ? match[1] : 'image/png';
};

// 重試機制
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000,
  signal?: AbortSignal
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Check if aborted before each attempt
    if (signal?.aborted) {
      throw new DOMException('Request was aborted', 'AbortError');
    }
    
    try {
      return await fn();
    } catch (error) {
      // If aborted, don't retry
      if ((error as Error).name === 'AbortError') {
        throw error;
      }
      
      lastError = error as Error;
      console.warn(`Attempt ${attempt + 1} failed:`, error);
      
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
      }
    }
  }
  
  throw lastError || new Error('All retry attempts failed');
}

// ===================== 文字生成 =====================

export const generateCreativeText = async (prompt: string): Promise<{ title: string; content: string }> => {
  const config = getApiConfig();
  
  if (!config.apiKey) {
    return { title: "未配置", content: "請先配置 API Key" };
  }

  try {
    const requestBody = {
      model: config.chatModel,
      messages: [
        { 
          role: 'system', 
          content: 'You are a creative assistant. Always respond in JSON format with "title" and "content" fields.' 
        },
        { 
          role: 'user', 
          content: `Expand this idea creatively: ${prompt}. Return JSON with 'title' and 'content'.` 
        }
      ],
      max_tokens: 2000,
      temperature: 0.7
    };

    const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API 請求失敗 (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    
    if (data.choices && data.choices.length > 0) {
      const content = data.choices[0].message.content.trim();
      try {
        return JSON.parse(content);
      } catch {
        return { title: "創意", content };
      }
    }

    throw new Error('API 未返回有效響應');
  } catch (error) {
    console.error("Text Generation Error:", error);
    return { title: "錯誤", content: "生成失敗，請檢查 API 配置" };
  }
};

// ===================== 高階 LLM（帶影象理解）=====================

export const generateAdvancedLLM = async (
  userPrompt: string, 
  systemInstruction?: string, 
  inputImages?: string[]
): Promise<string> => {
  const config = getApiConfig();
  
  if (!config.apiKey) {
    return "請先配置 API Key";
  }

  try {
    // 構建使用者訊息內容
    let userContent: any;
    
    if (inputImages && inputImages.length > 0) {
      // 帶圖片分析
      userContent = [
        { type: 'text', text: userPrompt }
      ];
      
      inputImages.forEach((img, index) => {
        const base64Data = extractBase64(img);
        const mimeType = getMimeType(img);
        userContent.push({
          type: 'image_url',
          image_url: { url: `data:${mimeType};base64,${base64Data}` }
        });
      });
    } else {
      userContent = userPrompt;
    }

    const messages: any[] = [];
    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }
    messages.push({ role: 'user', content: userContent });

    const requestBody = {
      model: config.chatModel,
      messages,
      max_tokens: 2000,
      temperature: 0.7
    };

    const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API 請求失敗 (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    
    if (data.choices && data.choices.length > 0) {
      return data.choices[0].message.content.trim();
    }

    throw new Error('API 未返回有效響應');
  } catch (error) {
    console.error("Advanced LLM Error:", error);
    return "執行 LLM 請求失敗";
  }
};

// ===================== 影象生成（文生圖）=====================

export const generateCreativeImage = async (prompt: string, genConfig?: GenerationConfig, signal?: AbortSignal): Promise<string | null> => {
  const config = getApiConfig();
  
  if (!config.apiKey) {
    console.error("API Key 未配置");
    return null;
  }

  try {
    // 對映寬高比
    let aspectRatio = '1:1';
    if (genConfig?.aspectRatio && genConfig.aspectRatio !== 'AUTO') {
      aspectRatio = genConfig.aspectRatio;
    }

    // 對映解析度
    let imageSize: '1K' | '2K' | '4K' = '1K';
    if (genConfig?.resolution) {
      imageSize = genConfig.resolution as '1K' | '2K' | '4K';
    }

    const requestBody: any = {
      model: config.model,
      prompt: prompt,
      response_format: 'url',
      aspect_ratio: aspectRatio,
      image_size: imageSize
    };

    const response = await withRetry(async () => {
      const res = await fetch(`${config.baseUrl}/v1/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal // Pass abort signal
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API 請求失敗 (${res.status}): ${errorText}`);
      }

      return res;
    }, 3, 1000, signal);

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    if (data.data && data.data.length > 0) {
      return data.data[0].url || `data:image/png;base64,${data.data[0].b64_json}`;
    }

    throw new Error('API 未返回圖片');
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.log('Image generation was cancelled');
      return null;
    }
    console.error("Image Generation Error:", error);
    return null;
  }
};

// ===================== 影象編輯（圖生圖）=====================

export const editCreativeImage = async (base64Images: string[], prompt: string, genConfig?: GenerationConfig, signal?: AbortSignal): Promise<string | null> => {
  const config = getApiConfig();
  
  if (!config.apiKey) {
    console.error("API Key 未配置");
    return null;
  }

  try {
    // 轉換圖片為正確格式
    const imageDataUrls = base64Images.map(img => {
      if (img.startsWith('data:')) {
        // 已經是 data URL 格式
        return img;
      } else if (img.startsWith('http://') || img.startsWith('https://')) {
        // 網路 URL，直接使用（API 支援 URL 輸入）
        return img;
      }
      // 純 base64 字串，新增字首
      return `data:image/png;base64,${img}`;
    });

    // 多圖處理：在提示詞中標註圖片順序（從上到下連線的順序 = Image1, Image2, ...）
    let enhancedPrompt = prompt || "Enhance this image";
    if (base64Images.length > 1) {
      const imageLabels = base64Images.map((_, idx) => `Image${idx + 1}`).join(', ');
      enhancedPrompt = `[Input images in order: ${imageLabels}]\n\n${enhancedPrompt}`;
      console.log(`[貞貞多圖] 檢測到 ${base64Images.length} 張圖片，已標註順序:`, imageLabels);
    }

    // 構建請求體
    const requestBody: any = {
      model: config.model,
      prompt: enhancedPrompt,
      response_format: 'url',
      image: imageDataUrls
    };

    // AUTO 模式（genConfig 為 undefined）時不傳遞 aspect_ratio，讓 API 根據原圖尺寸自動決定
    if (genConfig?.aspectRatio && genConfig.aspectRatio !== 'AUTO') {
      requestBody.aspect_ratio = genConfig.aspectRatio;
    }

    // 解析度配置
    if (genConfig?.resolution) {
      requestBody.image_size = genConfig.resolution;
    }

    const response = await withRetry(async () => {
      const res = await fetch(`${config.baseUrl}/v1/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal // Pass abort signal
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API 請求失敗 (${res.status}): ${errorText}`);
      }

      return res;
    }, 3, 1000, signal);

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    if (data.data && data.data.length > 0) {
      return data.data[0].url || `data:image/png;base64,${data.data[0].b64_json}`;
    }

    throw new Error('API 未返回圖片');
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.log('Image edit was cancelled');
      return null;
    }
    console.error("Image Edit Error:", error);
    return null;
  }
};

// ===================== 影片生成（暫不支援，返回提示）=====================

export const generateCreativeVideo = async (prompt: string, inputImageBase64?: string): Promise<string | null> => {
  const config = getApiConfig();
  
  // 嘗試使用影象生成 API 生成影片的靜態預覽幀
  if (config.apiKey && prompt) {
    console.warn("影片生成功能暫不支援，將生成靜態預覽影象");
    
    // 生成影片場景的靜態影象作為預覽
    try {
      const previewPrompt = `Cinematic still frame from video: ${prompt}. High quality, 16:9 aspect ratio, film quality.`;
      const result = await generateCreativeImage(previewPrompt, { aspectRatio: '16:9', resolution: '1K' });
      
      if (result) {
        // 返回生成的預覽影象（使用者可以下載或用於其他用途）
        return result;
      }
    } catch (e) {
      console.error("Failed to generate video preview:", e);
    }
  }
  
  return null;
};

// ===================== 餘額查詢 =====================

export const checkBalance = async (): Promise<string | null> => {
  const config = getApiConfig();
  
  if (!config.apiKey) {
    return null;
  }

  const endpoints = [
    '/v1/dashboard/billing/credit_grants',
    '/v1/billing/credit_grants',
    '/v1/me'
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(`${config.baseUrl}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (res.ok) {
        const data = await res.json();
        if (data.total_granted !== undefined) {
          return `總額: $${data.total_granted?.toFixed(2)} | 已用: $${data.total_used?.toFixed(2)}`;
        } else if (data.balance !== undefined) {
          return `餘額: $${data.balance?.toFixed(2)}`;
        }
      }
    } catch {
      continue;
    }
  }

  return null;
};
