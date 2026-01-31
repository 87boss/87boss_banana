
import { GoogleGenAI } from "@google/genai";
import type { GenerateContentResponse, Part } from "@google/genai";
import { GeneratedContent, CreativeIdea, SmartPlusConfig, BPField, BPAgentModel, ThirdPartyApiConfig, NanoBananaRequest, NanoBananaResponse, OpenAIChatRequest, OpenAIChatResponse } from '../types';

let ai: GoogleGenAI | null = null;

// 贞贞API配置存储
let thirdPartyConfig: ThirdPartyApiConfig | null = null;

export const setThirdPartyConfig = (config: ThirdPartyApiConfig | null) => {
  thirdPartyConfig = config;
};

export const getThirdPartyConfig = (): ThirdPartyApiConfig | null => {
  return thirdPartyConfig;
};

export const initializeAiClient = (apiKey: string) => {
  if (!apiKey) {
    ai = null;
    console.warn("API Key removed. AI Client de-initialized.");
    return;
  }
  try {
    ai = new GoogleGenAI({ apiKey });
  } catch (e) {
    ai = null;
    const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
    console.error("Failed to initialize AI Client:", errorMessage);
    throw new Error(`Failed to initialize AI Client. Please check your API key. Error: ${errorMessage}`);
  }
};

const withRetry = async <T>(
  apiCall: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000
): Promise<T> => {
  let lastError: unknown = new Error("Retry attempts failed.");
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      lastError = error;
      const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
      const isRetriable = errorMessage.includes('503') || errorMessage.includes('overloaded') || errorMessage.includes('unavailable');

      if (isRetriable && attempt < maxRetries) {
        console.warn(`Attempt ${attempt} failed with retriable error. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      } else {
        throw lastError;
      }
    }
  }
  throw lastError;
};

const fileToGenerativePart = async (file: File): Promise<Part> => {
  const base64EncodedDataPromise = new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result && typeof reader.result === 'string') {
        const parts = reader.result.split(',');
        resolve(parts[1] || '');
      } else {
        reject(new Error('文件读取失败'));
      }
    };
    reader.onerror = () => reject(new Error('文件读取出错'));
    reader.readAsDataURL(file);
  });
  return {
    inlineData: {
      data: await base64EncodedDataPromise,
      mimeType: file.type,
    },
  };
};

export interface ImageEditConfig {
  aspectRatio: string;
  imageSize: string;
  seed?: number; // 随机种子，用于重新生成
}

// 将文件转换为 base64
const fileToBase64 = async (file: File): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result && typeof reader.result === 'string') {
        const parts = reader.result.split(',');
        resolve(parts[1] || '');
      } else {
        reject(new Error('文件读取失败'));
      }
    };
    reader.onerror = () => reject(new Error('文件读取出错'));
    reader.readAsDataURL(file);
  });
};

// 将 aspectRatio 转换为 Nano-banana 支持的格式
const convertAspectRatio = (ratio: string): NanoBananaRequest['aspect_ratio'] | undefined => {
  const validRatios = ['4:3', '3:4', '16:9', '9:16', '2:3', '3:2', '1:1', '4:5', '5:4', '21:9'];
  if (ratio === 'Auto') {
    return undefined; // Auto 模式不指定比例，让API根据输入图片尺寸自动处理
  }
  if (!validRatios.includes(ratio)) {
    return '1:1'; // 无效比例时使用 1:1
  }
  return ratio as NanoBananaRequest['aspect_ratio'];
};

// 贞贞API图片生成 - 支持文生图和图生图（支持多图）
// 本地版本：直接调用贞贞API
export const editImageWithThirdPartyApi = async (
  files: File[], // 支持多图，空数组为文生图模式
  prompt: string,
  config: ImageEditConfig,
  creativeIdeaCost?: number // 创意库定义的扣费金额（本地版不用）
): Promise<GeneratedContent> => {
  if (!thirdPartyConfig || !thirdPartyConfig.enabled) {
    throw new Error("贞贞API未启用");
  }

  // 本地版本：需要前端配置 API Key
  if (!thirdPartyConfig.apiKey) {
    throw new Error("请先配置贞贞API Key");
  }
  if (!thirdPartyConfig.baseUrl) {
    throw new Error("请先配置贞贞API Base URL");
  }

  // 处理 Auto 宽高比：图生图模式下不传 aspect_ratio，让API根据输入图片尺寸自动生成
  const isAutoAspectRatio = config.aspectRatio === 'Auto';
  const hasInputImage = files.length > 0;

  if (isAutoAspectRatio && hasInputImage) {
    console.log('[Auto宽高比] 图生图模式，不指定比例，使用输入图片原始尺寸');
  }

  // 构建请求体 - Auto+图生图时完全不包含 aspect_ratio 字段
  const requestBody: NanoBananaRequest = {
    model: thirdPartyConfig.model || 'nano-banana-2',
    prompt: prompt,
    response_format: 'url',
    image_size: config.imageSize as '1K' | '2K' | '4K',
    seed: config.seed,
  };

  // 只有非 Auto 或文生图模式时才添加 aspect_ratio
  if (!isAutoAspectRatio) {
    requestBody.aspect_ratio = convertAspectRatio(config.aspectRatio);
  } else if (!hasInputImage) {
    // 文生图 + Auto：默认使用 1:1
    requestBody.aspect_ratio = '1:1';
  }
  // 图生图 + Auto：不添加 aspect_ratio 字段，让API使用输入图片的原始尺寸

  // 如果有上传图片，添加参考图（图生图模式，支持多图）
  if (files.length > 0) {
    const imagePromises = files.map(async (file) => {
      const imageBase64 = await fileToBase64(file);
      return `data:${file.type};base64,${imageBase64}`;
    });
    requestBody.image = await Promise.all(imagePromises);
  }

  // 直接调用贞贞API
  const url = `${thirdPartyConfig.baseUrl.replace(/\/$/, '')}/v1/images/generations`;

  const response = await withRetry(async () => {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${thirdPartyConfig!.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`API 请求失败 (${res.status}): ${errorText}`);
    }

    return res.json() as Promise<NanoBananaResponse>;
  });

  // 解析响应
  const result: GeneratedContent = { text: null, imageUrl: null };

  if (response.error) {
    throw new Error(`API 错误: ${response.error.message}`);
  }

  if (response.data && response.data.length > 0) {
    const imageData = response.data[0];
    if (imageData.url) {
      result.imageUrl = imageData.url;
    } else if (imageData.b64_json) {
      result.imageUrl = `data:image/png;base64,${imageData.b64_json}`;
    }
  }

  if (!result.imageUrl) {
    throw new Error("API 未返回图片");
  }

  return result;
};

// 贞贞API文字处理/图片分析 (Chat Completions)
// 本地版本：直接调用贞贞API
export const chatWithThirdPartyApi = async (
  systemPrompt: string,
  userMessage: string,
  imageFile?: File
): Promise<string> => {
  if (!thirdPartyConfig || !thirdPartyConfig.enabled) {
    throw new Error("贞贞API未启用");
  }

  // 本地版本：需要前端配置 API Key
  if (!thirdPartyConfig.apiKey) {
    throw new Error("请先配置贞贞API Key");
  }
  if (!thirdPartyConfig.baseUrl) {
    throw new Error("请先配置贞贞API Base URL");
  }

  // 构建用户消息内容 - 根据API文档格式
  type ContentItem = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };
  let userContent: string | ContentItem[];

  if (imageFile) {
    // 分析图片时，content需要是数组格式
    const imageBase64 = await fileToBase64(imageFile);
    const imageDataUrl = `data:${imageFile.type};base64,${imageBase64}`;
    userContent = [
      { type: 'text', text: userMessage },
      { type: 'image_url', image_url: { url: imageDataUrl } }
    ];
  } else {
    userContent = userMessage;
  }

  // 使用配置的chatModel，默认使用 gemini-2.5-pro
  const chatModel = thirdPartyConfig.chatModel || 'gemini-2.5-pro';

  const requestBody: OpenAIChatRequest = {
    model: chatModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ],
    max_tokens: 2000,
    temperature: 0.7,
    stream: false
  };

  // 直接调用贞贞API
  const url = `${thirdPartyConfig.baseUrl.replace(/\/$/, '')}/v1/chat/completions`;

  const response = await withRetry(async () => {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${thirdPartyConfig!.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Chat API 请求失败 (${res.status}): ${errorText}`);
    }

    return res.json() as Promise<OpenAIChatResponse>;
  });

  if (response.choices && response.choices.length > 0) {
    return response.choices[0].message.content.trim();
  }

  throw new Error("Chat API 未返回有效响应");
};

export const editImageWithGemini = async (files: File[], prompt: string, config: ImageEditConfig, creativeIdeaCost?: number): Promise<GeneratedContent> => {
  // 如果启用了贞贞API，使用贞贞API
  if (thirdPartyConfig && thirdPartyConfig.enabled) {
    return editImageWithThirdPartyApi(files, prompt, config, creativeIdeaCost);
  }

  if (!ai) {
    throw new Error("请先设置 Gemini API Key");
  }

  const model = 'gemini-3-pro-image-preview';

  if (!prompt) throw new Error("请输入提示词");

  // 构建内容 - 支持文生图和图生图（支持多图）
  let contents;

  if (files.length > 0) {
    // 图生图模式（支持多图）
    const imageParts = await Promise.all(files.map(file => fileToGenerativePart(file)));
    const instruction = files.length > 1
      ? '请根据以下提示词，参考所有输入图片进行编辑/融合/创作，只输出结果图片，不要输出任何文字描述。'
      : '请根据以下提示词编辑图片，只输出结果图片，不要输出任何文字描述。';
    const textPart: Part = { text: `${instruction}\n\n${prompt}` };
    contents = {
      parts: [...imageParts, textPart],
    };
  } else {
    // 文生图模式
    const instruction = '请根据以下提示词生成图片，只输出结果图片，不要输出任何文字描述。';
    const textPart: Part = { text: `${instruction}\n\n${prompt}` };
    contents = {
      parts: [textPart],
    };
  }

  // Configure image settings - TypeScript SDK 使用 camelCase
  const imageConfig: any = {
    imageSize: config.imageSize,
    // 注意：outputMimeType 在某些 Gemini API 版本中不支持，由 API 自动决定输出格式
  };

  // 处理 Auto 宽高比：图生图模式下不传 aspectRatio，让API根据输入图片尺寸自动生成
  if (config.aspectRatio === 'Auto') {
    if (files.length > 0) {
      // 图生图 + Auto：不传 aspectRatio，让Gemini使用输入图片的原始尺寸
      console.log('[Gemini Auto宽高比] 图生图模式，不指定比例，使用输入图片原始尺寸');
    }
    // 文生图 + Auto：也不指定 aspectRatio，让 Gemini 自动处理
  } else {
    // 用户明确指定了比例
    imageConfig.aspectRatio = config.aspectRatio;
  }

  const response: GenerateContentResponse = await withRetry(() =>
    ai!.models.generateContent({
      model: model,
      contents: contents,
      config: {
        responseModalities: ['IMAGE', 'TEXT'],
        imageConfig: imageConfig
      },
    })
  );

  const result: GeneratedContent = { text: null, imageUrl: null };

  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.text) {
        result.text = (result.text || "") + part.text;
      } else if (part.inlineData) {
        const base64ImageBytes: string = part.inlineData.data;
        const mimeType = part.inlineData.mimeType;
        result.imageUrl = `data:${mimeType};base64,${base64ImageBytes}`;
        break;
      }
    }
  }

  if (!result.imageUrl) {
    const responseText = result.text || response.candidates?.[0]?.content?.parts?.map(p => p.text).join(' ') || "No text response.";
    throw new Error("API 未返回图片，可能拒绝了请求。响应: " + responseText);
  }

  return result;
};

// --- BP Agent Logic ---

// 贞贞API的BP Agent任务（分析图片或纯文本）
const runBPAgentTaskWithThirdParty = async (file: File | null, instruction: string): Promise<string> => {
  const systemInstruction = file
    ? `You are an AI analysis agent. 
Your task is to analyze the image based on the user's specific instruction and extract/generate the relevant information.
Output Rule: Return ONLY the result string. Do not include labels, markdown, or conversational filler. Keep it concise and suitable for use in an image generation prompt.`
    : `You are an AI creative agent.
Your task is to generate creative content based on the user's instruction.
Output Rule: Return ONLY the result string. Do not include labels, markdown, or conversational filler. Keep it concise and suitable for use in an image generation prompt.`;

  return chatWithThirdPartyApi(systemInstruction, instruction, file || undefined);
};

const runBPAgentTask = async (file: File | null, instruction: string, model: BPAgentModel): Promise<string> => {
  // 如果启用了贞贞API，使用贞贞Chat API
  if (thirdPartyConfig && thirdPartyConfig.enabled) {
    // 本地版本：检查是否有API Key
    if (!thirdPartyConfig.apiKey) {
      throw new Error("请先配置贞贞API Key");
    }
    return runBPAgentTaskWithThirdParty(file, instruction);
  }

  // 使用 Gemini API
  if (!ai) throw new Error("请先设置 Gemini API Key 或启用贞贞API");

  // 构建内容部分
  const parts: Part[] = [];

  // 如果有图片，添加图片部分
  if (file) {
    const imagePart = await fileToGenerativePart(file);
    parts.push(imagePart);
  }

  // 添加文本指令
  parts.push({ text: instruction } as Part);

  // 根据是否有图片调整系统指令
  const systemInstruction = file
    ? `You are an AI analysis agent. 
    Your task is to analyze the image based on the user's specific instruction and extract/generate the relevant information.
    Output Rule: Return ONLY the result string. Do not include labels, markdown, or conversational filler. Keep it concise and suitable for use in an image generation prompt.`
    : `You are an AI creative agent.
    Your task is to generate creative content based on the user's instruction.
    Output Rule: Return ONLY the result string. Do not include labels, markdown, or conversational filler. Keep it concise and suitable for use in an image generation prompt.`;

  const response: GenerateContentResponse = await withRetry(() =>
    ai!.models.generateContent({
      model: model,
      contents: { parts },
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      }
    })
  );

  const text = response.text;
  if (!text) return "";
  return text.trim();
};

export const processBPTemplate = async (
  file: File | null,
  templateIdea: CreativeIdea,
  userInputs: Record<string, string>
): Promise<string> => {
  console.log('[BP Template] 开始处理:', {
    title: templateIdea.title,
    hasBpFields: !!templateIdea.bpFields,
    fieldsCount: templateIdea.bpFields?.length || 0,
    agentCount: templateIdea.bpFields?.filter(f => f.type === 'agent').length || 0,
    hasFile: !!file,
    userInputs
  });

  if (!templateIdea.bpFields || templateIdea.bpFields.length === 0) {
    console.log('[BP Template] 没有bpFields，返回原始提示词');
    return templateIdea.prompt;
  }

  let finalPrompt = templateIdea.prompt;
  const fields = templateIdea.bpFields;

  // 构建字段名称到ID的映射
  const nameToId: Record<string, string> = {};
  const nameToField: Record<string, typeof fields[0]> = {};
  fields.forEach(f => {
    nameToId[f.name] = f.id;
    nameToField[f.name] = f;
  });

  // 解析Agent指令中的依赖
  const parseDependencies = (instruction: string): { inputs: string[], agents: string[] } => {
    const inputs: string[] = [];
    const agents: string[] = [];

    // 匹配 /变量名 (用户输入)
    const inputMatches = instruction.match(/\/([a-zA-Z_][a-zA-Z0-9_]*)/g);
    if (inputMatches) {
      inputMatches.forEach(match => {
        const name = match.slice(1); // 移除 /
        if (nameToField[name]?.type === 'input') {
          inputs.push(name);
        }
      });
    }

    // 匹配 {变量名} (Agent结果)
    const agentMatches = instruction.match(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g);
    if (agentMatches) {
      agentMatches.forEach(match => {
        const name = match.slice(1, -1); // 移除 { 和 }
        if (nameToField[name]?.type === 'agent') {
          agents.push(name);
        }
      });
    }

    return { inputs, agents };
  };

  // 分类Agent：依赖图片的 vs 纯文本分析的
  const agentFields = fields.filter(f => f.type === 'agent');
  const inputFields = fields.filter(f => f.type === 'input');

  // 构建依赖图并进行拓扑排序
  const agentDependencies: Record<string, { inputs: string[], agents: string[] }> = {};
  agentFields.forEach(agent => {
    if (agent.agentConfig) {
      agentDependencies[agent.name] = parseDependencies(agent.agentConfig.instruction);
    } else {
      agentDependencies[agent.name] = { inputs: [], agents: [] };
    }
  });

  // 拓扑排序：确定Agent执行顺序
  const executionOrder: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>(); // 用于检测循环依赖

  const topologicalSort = (agentName: string): boolean => {
    if (visited.has(agentName)) return true;
    if (visiting.has(agentName)) {
      console.warn(`检测到循环依赖: ${agentName}`);
      return false; // 循环依赖
    }

    visiting.add(agentName);

    const deps = agentDependencies[agentName];
    if (deps) {
      // 先处理依赖的Agent
      for (const depAgent of deps.agents) {
        if (!topologicalSort(depAgent)) {
          return false;
        }
      }
    }

    visiting.delete(agentName);
    visited.add(agentName);
    executionOrder.push(agentName);
    return true;
  };

  // 对所有Agent进行拓扑排序
  for (const agent of agentFields) {
    topologicalSort(agent.name);
  }

  // 存储结果
  const agentResults: Record<string, string> = {};

  // 按顺序执行Agent
  for (const agentName of executionOrder) {
    const field = nameToField[agentName];
    if (!field || field.type !== 'agent' || !field.agentConfig) continue;

    let instruction = field.agentConfig.instruction;

    // 替换指令中的用户输入 /Name
    inputFields.forEach(inputField => {
      const val = userInputs[inputField.id] || '';
      instruction = instruction.split(`/${inputField.name}`).join(val);
    });

    // 替换指令中已执行Agent的结果 {Name}
    for (const [name, result] of Object.entries(agentResults)) {
      instruction = instruction.split(`{${name}}`).join(result);
    }

    // 执行Agent
    try {
      console.log(`[BP Agent] 执行 ${agentName}...`);
      const result = await runBPAgentTask(file, instruction, field.agentConfig.model);
      console.log(`[BP Agent] ${agentName} 完成`);
      agentResults[agentName] = result;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.error(`[BP Agent] ${agentName} 失败`);
      // 显示更详细的错误信息
      agentResults[agentName] = `[Agent错误: ${errorMsg}]`;
    }
  }

  // 替换最终模板中的Agent结果 {Name}
  for (const [name, result] of Object.entries(agentResults)) {
    finalPrompt = finalPrompt.split(`{${name}}`).join(result);
  }

  // 替换最终模板中的用户输入 /Name
  inputFields.forEach(f => {
    const val = userInputs[f.id] || '';
    finalPrompt = finalPrompt.split(`/${f.name}`).join(val);
  });

  return finalPrompt;
};


// --- Legacy Smart Logic ---

const getSmartSystemInstruction = () => `You are a "Creative Prompt Fusion Specialist." Your goal is to merge a 'Modifier Keyword' into a 'Base Prompt' intelligently.

**Principles:**
1. **Base Prompt is Law**: Preserve the main subject and intent.
2. **Keyword is Adjective**: Treat it as a descriptive layer.
3. **Output**: ONLY the final prompt string. No explanations.`;

const getSmartPlusSystemInstruction = () => `You are a commercial **Art Director**. Synthesize a conceptual brief into a vivid scene description for a high-end product photoshoot.

**Output Rules:**
* Output ONLY the final prompt string.
* Single paragraph.
* Descriptive and professional. No markdown.`;


interface GeneratePromptParams {
  file: File;
  idea: CreativeIdea;
  keyword?: string; // For Smart
  smartPlusConfig?: SmartPlusConfig; // For Smart+
}


/**
 * Analyze interior image(s) to generate BIM data
 */
export const analyzeInteriorImage = async (
  imageData: string, // base64 without prefix
  mimeType: string = 'image/png',
  userDimensions?: { width?: number; height?: number; depth?: number }
): Promise<any> => { // Returns BIMData
  try {
    console.log('🚀 [Gemini] Starting Interior Analysis...');
    const modelName = 'gemini-3-pro-image-preview'; // Standardized model

    if (!ai) {
      throw new Error("Gemini API Key is not configured. Please set it in Settings.");
    }

    // Schema Definition Prompt
    const schemaDefinition = `
export interface Dimensions { width: number; height: number; depth?: number; area?: number; }
export interface MaterialInfo { name: string; description?: string; estimatedCostPerUnit?: number; }
export type SurfaceType = 'wall' | 'floor' | 'ceiling' | 'window' | 'door' | 'partition';
export interface Surface { id: string; type: SurfaceType; material: MaterialInfo; dimensions: Dimensions; position?: string; }
export interface Furniture { id: string; name: string; category: string; dimensions?: Dimensions; position?: string; material?: string; estimatedPrice?: number; }

// Categories must be EXACTLY one of these 13 strings:
export type QuotationCategory = 
  | '天花板' | '牆面' | '門窗' | '地面' | '櫃體' | '燈具' 
  | '開關插座' | '電器' | '家具' | '軟裝' | '拆除清運' | '保護工程' | '其他';

export interface QuotationItem { 
  id: string; 
  category: QuotationCategory; 
  item: string; 
  description: string; 
  quantity: number; 
  unit: string; 
  unitPrice: number; 
  totalPrice: number; 
}
export interface SpaceInfo { roomType: string; dimensions: Dimensions; designStyle: string; }
export interface BIMData { space: SpaceInfo; surfaces: Surface[]; furniture: Furniture[]; estimatedQuotation: QuotationItem[]; totalEstimatedBudget: number; usageAnalysis: string; }
`;

    // Construct constraint string if dimensions are provided
    let constraintPrompt = "";
    if (userDimensions) {
      const constraints = [];
      if (userDimensions.depth) constraints.push(`Length/Depth: ${userDimensions.depth}m`);
      if (userDimensions.width) constraints.push(`Width: ${userDimensions.width}m`);
      if (userDimensions.height) constraints.push(`Height: ${userDimensions.height}m`);

      if (constraints.length > 0) {
        constraintPrompt = `
        **CRITICAL SPATIAL CONSTRAINTS (KNOWN GROUND TRUTH):**
        The user has provided the following ACTUAL dimensions for this space. You MUST use these values for your calculations.
        ${constraints.join('\n')}
        Scale all other objects (furniture, windows, etc.) relative to these known dimensions.
        `;
      }
    }

    const prompt = `
      You are an expert BIM (Building Information Modeling) Engineer, Interior Designer, and Quantity Surveyor.
      
      Task: 
      Analyze the provided interior image and reconstruct a detailed 3D understanding of the space.
      Identify all surfaces (walls, floor, ceiling), furniture, and materials.
      ${constraintPrompt ? constraintPrompt : "Estimate dimensions (in meters) based on standard furniture sizes (e.g., standard chair height ~0.45m)."}
      
      Generate a preliminary Quotation/Bill of Quantities (BoQ) for renovating this space provided in the image (or constructing it if it's a render).
      
      Output strictly valid JSON matching the following TypeScript interface (do not include markdown code blocks, just the raw JSON or wrapped in \`\`\`json):
      
      ${schemaDefinition}
      
      **CRITICAL INSTRUCTION: LANGUAGE**
      All text content (names, descriptions, categories, usage analysis, etc.) MUST be in **Traditional Chinese (Taiwan) / 繁體中文(台灣)**.
      Only the JSON keys (e.g., "id", "type", "material", "dimensions") must remain in English as defined in the interface.
      
      **CRITICAL INSTRUCTION: CATEGORIES**
      You MUST strictly categorize every quotation item into one of the following 13 categories (and only these):
      1. 天花板
      2. 牆面
      3. 門窗
      4. 地面
      5. 櫃體
      6. 燈具
      7. 開關插座
      8. 電器
      9. 家具
      10. 軟裝
      11. 拆除清運
      12. 保護工程
      13. 其他
      
      Provide realistic market rates (in TWD - New Taiwan Dollar) for the quotation estimation.
      Ensure 'totalEstimatedBudget' is the sum of all 'totalPrice' in 'estimatedQuotation'.
    `;

    // 使用新的 SDK 语法 (GoogleGenAI v1+)
    const response: GenerateContentResponse = await withRetry(() =>
      ai!.models.generateContent({
        model: modelName,
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: imageData,
                  mimeType: mimeType
                }
              }
            ]
          }
        ]
      })
    );

    let text = response.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('Gemini API returned no text response.');
    }

    // Clean up markdown
    text = text.replace(/```json\n?|\n?```/g, "").trim();

    try {
      const json = JSON.parse(text);
      console.log('✅ [Gemini] BIM Analysis Complete');
      return json;
    } catch (e) {
      console.error('❌ [Gemini] Failed to parse BIM JSON:', text);
      throw new Error('Failed to parse Gemini response as JSON');
    }

  } catch (error) {
    console.error('❌ [Gemini] Interior Analysis Failed:', error);
    throw error;
  }
};


export const generateCreativePromptFromImage = async ({
  file,
  idea,
  keyword = '',
  smartPlusConfig,
}: GeneratePromptParams): Promise<string> => {
  // 如果启用了贞贞API，使用贞贞API
  const useThirdParty = thirdPartyConfig && thirdPartyConfig.enabled && thirdPartyConfig.apiKey;

  if (!useThirdParty && !ai) {
    throw new Error("请先设置 Gemini API Key 或配置贞贞API");
  }

  const model = 'gemini-3-pro-image-preview';

  if (!file) throw new Error("请上传图片");

  // If BP, use the new processor (should be called directly, but handling here for safety)
  if (idea.isBP) {
    throw new Error("BP Mode should use processBPTemplate directly.");
  }

  let systemInstruction = '';

  let userMessage = '';

  if (idea.isSmartPlus && smartPlusConfig) {
    // Smart+ Mode
    systemInstruction = getSmartPlusSystemInstruction();
    userMessage += `Story Brief:
"""
${idea.prompt}
"""

`;
    if (keyword.trim()) {
      userMessage += `Keywords:
"""
${keyword}
"""

`;
    }
    userMessage += `Key Elements:\n`;

    const templateConfig = idea.smartPlusConfig || [];

    templateConfig.forEach(templateComponent => {
      if (templateComponent.enabled) {
        const overrideComponent = smartPlusConfig.find(c => c.id === templateComponent.id);

        if (overrideComponent && overrideComponent.enabled) {
          const featureText = overrideComponent.features.trim() || 'Describe creatively based on the Story Brief';
          userMessage += `- ${overrideComponent.label}: ${featureText}\n`;
        } else {
          userMessage += `- ${templateComponent.label}: [GENERATE CREATIVELY]\n`;
        }
      }
    });
  } else {
    // Standard Smart Mode (Legacy support or simple mode)
    systemInstruction = getSmartSystemInstruction();
    userMessage += `Base Prompt:
"""
${idea.prompt}
"""

Modifier Keyword:
"""
${keyword}
"""

`;
  }

  userMessage += "\n\nNow, based on the provided image and all the rules, generate the final, synthesized prompt.";

  // 使用贞贞API进行图片分析
  if (useThirdParty) {
    return chatWithThirdPartyApi(systemInstruction, userMessage, file);
  }

  // 使用 Gemini API
  const imagePart = await fileToGenerativePart(file);
  const textPart: Part = { text: userMessage };

  const contents = {
    parts: [imagePart, textPart],
  };

  const response: GenerateContentResponse = await withRetry(() =>
    ai!.models.generateContent({
      model: model,
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
      },
    })
  );

  const resultText = response.text;

  if (!resultText) {
    throw new Error("API 未返回文本响应");
  }

  return resultText.trim();
};

/**
 * 优化提示词 - 无创意库模式
 * 揥收用户输入的简单描述，让模型揣测意图并扩写成更完整的提示词
 */
export const optimizePrompt = async (userPrompt: string): Promise<string> => {
  // 检查API配置
  const useThirdParty = thirdPartyConfig && thirdPartyConfig.enabled && thirdPartyConfig.apiKey;

  if (!useThirdParty && !ai) {
    throw new Error("请先设置 Gemini API Key 或配置贞贞API");
  }

  const model = 'gemini-3-pro-image-preview';

  const systemInstruction = `You are an expert AI image generation prompt engineer. Your task is to take a user's brief description or keywords and expand them into a detailed, high-quality image generation prompt.

Rules:
1. Understand the user's intent from their brief input
2. Expand the description with relevant details about:
   - Subject details and characteristics
   - Art style and visual aesthetic
   - Lighting and atmosphere
   - Composition and framing
   - Color palette and mood
3. Keep the expanded prompt focused and coherent
4. Output ONLY the optimized prompt text, no explanations
5. The output should be in the same language as the input
6. Keep output concise but descriptive (aim for 50-150 words)`;

  const userMessage = `Please optimize and expand this brief prompt into a detailed image generation prompt:

"""${userPrompt}"""

Output the optimized prompt directly:`;

  // 使用贞贞API - 直接复用现有函数，不传图片
  if (useThirdParty) {
    return chatWithThirdPartyApi(systemInstruction, userMessage);
  }

  // 使用 Gemini API
  const response: GenerateContentResponse = await withRetry(() =>
    ai!.models.generateContent({
      model: model,
      contents: { parts: [{ text: userMessage }] },
      config: {
        systemInstruction: systemInstruction,
      },
    })
  );

  const resultText = response.text;

  if (!resultText) {
    throw new Error("API 未返回文本响应");
  }

  return resultText.trim();
};

/**
 * 圖片反推 - 分析圖片並提取關鍵字與詳細提示詞
 */
// 室內設計反推規則
const INTERIOR_DESIGN_PROMPT = `
You are an expert Interior Design AI agent. Your task is to analyze the provided image and extract specific design details based on the following categories.

Checklist & Keywords to Extract:
1. Category: 天花板 (Ceiling)
   - Check: Ceiling types, beams, moldings
   - Keywords ex: 平釘天花板, 造型天花板, 軌道燈溝槽

2. Category: 牆面 (Walls)
   - Check: Wall materials, paint, panels
   - Keywords ex: 大理石牆面, 實木貼皮, 藝術塗料, 清水模

3. Category: 門窗 (Windows & Doors)
   - Check: Windows, doors, frames, glass
   - Keywords ex: 落地窗, 鋁框拉門, 百葉窗, 長虹玻璃

4. Category: 地面 (Floor)
   - Check: Flooring materials, rugs
   - Keywords ex: 超耐磨木地板, 石英磚, 盤多磨, 編織地毯

5. Category: 櫃體 (Cabinetry)
   - Check: Wardrobes, shelves, kitchen units
   - Keywords ex: 系統衣櫃, 玻璃展示櫃, 中島吧台, 電視櫃

6. Category: 傢俱 (Furniture)
   - Check: Sofa, tables, chairs, beds
   - Keywords ex: L型沙發, 實木餐桌, 單人扶手椅, 雙人床架

7. Category: 家電設備 (Appliances)
   - Check: Electronics, kitchen appliances
   - Keywords ex: 壁掛電視, 嵌入式烤箱, 智慧冰箱

8. Category: 軟裝與飾品 (Decor)
   - Check: Curtains, art, plants, cushions
   - Keywords ex: 蛇形簾, 抽象掛畫, 龜背芋, 抱枕

9. Category: 材質與色彩 (Materials & Colors)
   - Check: Textures, color palette
   - Keywords ex: 淺橡木, 黃銅金屬, 奶茶色系, 莫蘭迪色

10. Category: 燈具 (Fixtures)
    - Check: Physical light fixtures (pendant, floor, recessed)
    - Keywords ex: 線性吊燈, 崁燈, 落地燈, 壁燈

11. Category: 燈光氛圍 (Lighting Atmosphere)
    - Check: Light quality, temperature, shadows, natural light
    - Keywords ex: 間接照明, 暖白光 (3000K), 自然光, 電影感光影

12. Category: 室內風格 (Interior Style)
    - Check: Overall design style, era
    - Keywords ex: 現代簡約風, 北歐風, 工業風, 日式無印風

13. Category: 攝影鏡頭 (Camera)
    - Check: Camera angle, focal length, depth of field
    - Keywords ex: 廣角鏡頭, 景深效果, 正視圖, 建築攝影

Output must be a valid JSON object with the following structure:
{
  "categories": [
    { "name": "天花板", "keywords": ["keyword1", "keyword2"] },
    { "name": "牆面", "keywords": ["keyword1", "keyword2"] },
    ...
  ],
  "detailedPrompt": "A detailed, descriptive prompt..." // A professional interior design prompt incorporating the extracted details, in Traditional Chinese (繁體中文).
}

Rules:
1. Keywords must be in Traditional Chinese (繁體中文).
2. The detailedPrompt must be in Traditional Chinese (繁體中文).
3. Ensure strictly categorize keywords. If a category has no relevant details, leave keywords empty.
4. Respond ONLY with the JSON string.
`;

const GENERAL_PROMPT = `You are an expert AI image analysis agent. Your task is to analyze the provided image and extract relevant information.

Output must be a valid JSON object with the following structure:
{
  "categories": [
    { "name": "通用關鍵字", "keywords": ["keyword1", "keyword2", ...] } // Extract 15-20 distinctive visual keywords in Traditional Chinese.
  ],
  "detailedPrompt": "..." // A comprehensive prompt in Traditional Chinese.
}

Rules:
1. Keywords must be in Traditional Chinese (繁體中文).
2. The detailedPrompt must be in Traditional Chinese (繁體中文).
3. Respond ONLY with the JSON string.
`;

/**
 * 圖片反推 - 分析圖片並提取關鍵字與詳細提示詞
 */
export const analyzeImageForPrompt = async (
  file: File,
  mode: 'general' | 'interior' = 'general'
): Promise<{ categories: { name: string; keywords: string[] }[]; detailedPrompt: string }> => {
  const useThirdParty = thirdPartyConfig && thirdPartyConfig.enabled && thirdPartyConfig.apiKey;

  if (!useThirdParty && !ai) {
    throw new Error("請先設置 Gemini API Key 或配置貞贞API");
  }

  // 使用 Gemini 3 Pro Image Preview (全能多模態)
  const model = 'gemini-3-pro-image-preview';

  const systemInstruction = mode === 'interior' ? INTERIOR_DESIGN_PROMPT : GENERAL_PROMPT;

  const userMessage = "Analyze this image and provide categorized keywords and a detailed prompt in JSON format. OUTPUT MUST BE IN TRADITIONAL CHINESE.";

  let resultText = '';

  try {
    if (useThirdParty) {
      resultText = await chatWithThirdPartyApi(systemInstruction, userMessage, file);
    } else {
      const imagePart = await fileToGenerativePart(file);
      const response = await withRetry(() =>
        ai!.models.generateContent({
          model: model,
          contents: {
            parts: [imagePart, { text: userMessage }]
          },
          config: {
            systemInstruction: systemInstruction,
            responseMimeType: 'application/json', // 確保返回 JSON
          },
        })
      );
      resultText = response.text || '';
    }

    // 清理可能包含的 markdown 代碼塊標記
    const jsonStr = resultText.replace(/```json\n?|\n?```/g, '').trim();

    const result = JSON.parse(jsonStr);

    // 兼容舊格式 (如果AI返回了舊格式)
    let categories: { name: string; keywords: string[] }[] = [];
    if (Array.isArray(result.categories)) {
      categories = result.categories;
    } else if (Array.isArray(result.keywords)) {
      // 舊版回傳格式 Array of strings
      categories = [{ name: '關鍵字', keywords: result.keywords }];
    } else if (typeof result.keywords === 'object') {
      // 舊版回傳格式 Object (key: []string)
      categories = Object.entries(result.keywords).map(([name, kws]) => ({
        name,
        keywords: Array.isArray(kws) ? (kws as string[]) : []
      }));
    }

    return {
      categories: categories,
      detailedPrompt: typeof result.detailedPrompt === 'string' ? result.detailedPrompt : ''
    };
  } catch (error) {
    console.error("Image analysis failed:", error);
    throw new Error("無法分析圖片，請稍後再試");
  }
};

/**
 * Generate a technical engineering/construction drawing for a specific item
 */
export const generateEngineeringDrawing = async (
  originalImageBase64: string,
  itemDescription: string,
  userCommand?: string
): Promise<string> => {
  if (!ai && !(thirdPartyConfig && thirdPartyConfig.enabled)) {
    throw new Error("AI Service not configured");
  }

  // Convert base64 to File object for the editImageWithGemini function
  const cleanBase64 = originalImageBase64.replace(/^data:image\/\w+;base64,/, "");
  const byteCharacters = atob(cleanBase64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'image/png' }); // Default to png
  const file = new File([blob], "original_context.png", { type: 'image/png' });

  const prompt = `
    Generate a professional technical construction drawing (CAD style engineering drawing) for the following item:
    "${itemDescription}"
    
    Context:
    This item fits within the interior space shown in the input image.
    
    Style Requirements:
    - 2D Technical Drawing (Elevation or Section view).
    - Black lines on white background (Blueprint or CAD style).
    - Include technical annotations and dimension lines (mock values are fine if exact are unknown, but make them realistic).
    - Clean, precise lines.
    - Aspect Ratio: 2:3 (Vertical).
    
    ${userCommand ? `Additional User Command: ${userCommand}` : ''}
    
    The output must strictly be the engineering drawing image only.
  `;

  // Use editImageWithGemini which handles Img2Img
  const result = await editImageWithGemini(
    [file],
    prompt,
    {
      aspectRatio: '2:3',
      imageSize: '1K', // 2K might be too slow/expensive, start with 1K or map to appropriate sizing
    }
  );

  if (!result.imageUrl) {
    throw new Error("Failed to generate engineering drawing");
  }

  return result.imageUrl;
};

export const generateCoverPrompts = async (
  theme: string,
  title: string,
  subtitle: string,
  footer: string,
  textEffect: string,
  count: number,
  scene: string,
  plot: string,
  media: string,
  apiKey?: string,
  thirdPartyConfig?: ThirdPartyApiConfig
): Promise<string[]> => {
  // Check logic matching generateCreativePromptFromImage
  const useThirdParty = thirdPartyConfig && thirdPartyConfig.enabled && thirdPartyConfig.apiKey;
  if (!useThirdParty && !ai) {
    throw new Error("請先設置 Gemini API Key 或配置貞贞API");
  }

  const modelName = 'gemini-3-pro-image-preview'; // Matching user request/reference

  // Dynamic check for text constraints
  const hasTitle = title && title.trim().length > 0;
  const hasSubtitle = subtitle && subtitle.trim().length > 0;
  const hasFooter = footer && footer.trim().length > 0;

  const titleInstruction = hasTitle
    ? `- Main Title: "${title}"`
    : `- Main Title: [NONE] (Do NOT include any title text)`;

  const subtitleInstruction = hasSubtitle
    ? `- Subtitle: "${subtitle}"`
    : `- Subtitle: [NONE] (Do NOT include any subtitle text)`;

  const footerInstruction = hasFooter
    ? `- Footer text: "${footer}"`
    : `- Footer text: [NONE] (Do NOT include any footer text)`;

  // Build the text rendering instruction dynamically
  let textRenderingInstruction = `5. **CRITICAL: TEXT RENDERING**: `;
  if (!hasTitle && !hasSubtitle && !hasFooter) {
    textRenderingInstruction += `You MUST explicitly instruct the image generator NOT to render any text. The image should be text-free.`;
  } else {
    textRenderingInstruction += `You MUST explicitly instruct the image generator to RENDER the text ONLY if provided:\n`;
    if (hasTitle) {
      textRenderingInstruction += `   - **Title**: Include "${title}" written in bold typography. Apply the "${textEffect}" effect if applicable.\n`;
    } else {
      textRenderingInstruction += `   - **Title**: Do NOT include any main title text.\n`;
    }

    if (hasSubtitle) {
      textRenderingInstruction += `   - **Subtitle**: Include "${subtitle}" in smaller font.\n`;
    }

    if (hasFooter) {
      textRenderingInstruction += `   - **Footer**: Include "${footer}" at the bottom.\n`;
    }
  }

  // Handle "Random" style logic
  let styleInstruction = `3. **Magazine Style**: The user has selected the magazine style "${media}". Ensure the generated image strictly follows the aesthetic, layout, and visual language of this specific magazine.`;
  if (media === 'Random Magazine Style') {
    styleInstruction = `3. **Magazine Style**: You MUST randomly check a high-end magazine style (e.g. Vogue, Kinfolk, Time, Brutus, etc.) for EACH prompt. Ensure every prompt has a DIFFERENT, distinct magazine style.`;
  }

  const systemPrompt = `You are an expert AI Art Director specializing in HIGH-END MAGAZINE COVER design.
Your task is to generate ${count} distinct, high-quality AI image prompts based on the following metadata:
- Theme/Style/Context: "${theme}"
- Magazine Style: "${media}"
${titleInstruction}
${subtitleInstruction}
${footerInstruction}
- Text Effect: "${textEffect}"

Guidelines:
1. Each prompt must describe a **MAGAZINE COVER VISUAL**.
2. Incorporate the "Theme" into the visual style.
${styleInstruction}
4. **NO SOCIAL MEDIA BIAS**: Do NOT mention "Instagram", "Social Media", "Post", "Feed", or "Like". This is a MAGAZINE COVER, not a social post.
${textRenderingInstruction}
6. Provide variety in composition (close-up, wide shot, centralized).
7. **LANGUAGE**: The Output Prompts MUST be in **Traditional Chinese (繁體中文)**.
8. Return ONLY a valid JSON array of strings. No markdown, no "Here are...".
Example output: ["一張充滿 VOGUE 時尚感的封面，模特兒身穿...", "復古 TIME 雜誌風格的設計，強調..."]`;

  try {
    let resultText = '';

    // 1. Third Party Path
    if (useThirdParty) {
      console.log('[Cover] Generating with Third Party API...', { model: thirdPartyConfig!.chatModel });
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      try {
        const response = await fetch(`${thirdPartyConfig!.baseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${thirdPartyConfig!.apiKey}`
          },
          body: JSON.stringify({
            model: thirdPartyConfig!.chatModel || 'gemini-2.0-flash-exp',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `Generate ${count} prompts.` }
            ],
            temperature: 0.7
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errText = await response.text();
          console.error('[ThirdParty API Error]', response.status, errText);
          throw new Error(`ThirdParty API failed (${response.status}): ${errText}`);
        }
        const data = await response.json();
        resultText = data.choices[0].message.content;
      } catch (e: any) {
        clearTimeout(timeoutId);
        if (e.name === 'AbortError') {
          throw new Error('Request timed out (30s)');
        }
        throw e;
      }

    } else {
      // 2. Local Gemini Path (using SDK + 3 Pro)
      const response: GenerateContentResponse = await withRetry(() =>
        ai!.models.generateContent({
          model: modelName,
          contents: [
            {
              parts: [
                { text: systemPrompt + "\n\nGenerate the prompts." }
              ]
            }
          ],
          config: {
            temperature: 0.7
          }
        })
      );

      resultText = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!resultText) {
        throw new Error('Gemini API returned no text response.');
      }
    }

    // Clean up markdown block if present
    const jsonStr = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
    const prompts = JSON.parse(jsonStr);

    if (Array.isArray(prompts)) {
      return prompts.slice(0, count);
    }
    return [];

  } catch (error) {
    console.error("Cover Prompt Generation Failed:", error);
    throw error;
  }
};

/**
 * 翻譯文本到繁體中文
 */
export const translateText = async (text: string): Promise<string> => {
  const useThirdParty = thirdPartyConfig && thirdPartyConfig.enabled && thirdPartyConfig.apiKey;

  // Auto-initialize if needed
  if (!useThirdParty && !ai) {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
      initializeAiClient(savedKey);
    }
  }

  if (!useThirdParty && !ai) {
    console.warn("AI service not ready for translation, returning original text.");
    return text;
  }

  // Simple check if text is already likely Chinese (contains Chinese characters)
  if (/[\u4e00-\u9fa5]/.test(text)) {
    return text;
  }

  const systemPrompt = `You are a professional translator. Translate the following text into Traditional Chinese (Taiwan).
  - Output ONLY the translated text.
  - Keep IT terms or specific brand names in English if appropriate, or provide standard translations.
  - Be concise.`;

  try {
    let resultText = '';
    if (useThirdParty) {
      resultText = await chatWithThirdPartyApi(systemPrompt, text);
    } else {
      const model = 'gemini-2.0-flash-exp'; // Fast model for translation
      const response = await withRetry(() =>
        ai!.models.generateContent({
          model: model,
          contents: { parts: [{ text: `Translate to Traditional Chinese: ${text}` }] },
          config: { systemInstruction: systemPrompt },
        })
      );
      resultText = response.text || text;
    }
    return resultText.trim();
  } catch (error) {
    console.error("Translation failed:", error);
    return text;
  }
};


