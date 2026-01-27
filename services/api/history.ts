// 历史记录相关 API - 本地版本
import { get, post, del } from './index';
import { GenerationHistory, ThirdPartyApiConfig } from '../../types';
import { saveToOutput, downloadRemoteToOutput } from './files';

// 获取所有历史记录
export const getAllHistory = async (): Promise<{ success: boolean; data?: GenerationHistory[]; error?: string }> => {
  return get<GenerationHistory[]>('/history');
};

// 获取历史记录列表（兼容旧接口）
export const getHistoryList = async (page: number = 1, limit: number = 20): Promise<{
  success: boolean;
  data?: {
    items: GenerationHistory[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  error?: string
}> => {
  const result = await get<GenerationHistory[]>('/history');
  if (result.success && result.data) {
    const items = result.data;
    const start = (page - 1) * limit;
    const end = start + limit;
    return {
      success: true,
      data: {
        items: items.slice(start, end),
        total: items.length,
        page,
        limit,
        totalPages: Math.ceil(items.length / limit),
      },
    };
  }
  return { success: false, error: 'error' in result ? result.error : '请求失败' };
};

// 获取单条历史记录
export const getHistoryById = async (id: number): Promise<{ success: boolean; data?: GenerationHistory; error?: string }> => {
  const result = await get<GenerationHistory[]>('/history');
  if (result.success && result.data) {
    const item = result.data.find(h => h.id === id);
    if (item) {
      return { success: true, data: item };
    }
    return { success: false, error: '记录不存在' };
  }
  return { success: false, error: 'error' in result ? result.error : '请求失败' };
};

// 创建历史记录
export const createHistory = async (history: Omit<GenerationHistory, 'id'>): Promise<{ success: boolean; data?: GenerationHistory; error?: string }> => {
  return post<GenerationHistory>('/history', history);
};

// 删除历史记录
export const deleteHistory = async (id: number): Promise<{ success: boolean; error?: string; message?: string }> => {
  return del(`/history/${id}`);
};

// 清空所有历史记录
export const clearAllHistory = async (): Promise<{ success: boolean; error?: string; message?: string }> => {
  return del('/history');
};
// 保存生成的图像到历史记录
export const saveToHistory = async (
  imageUrl: string,
  promptText: string,
  isThirdParty: boolean,
  thirdPartyApiConfig: ThirdPartyApiConfig,
  inputFiles?: File[],
  creativeInfo?: {
    templateId?: number;
    templateType: 'smart' | 'smartPlus' | 'bp' | 'none';
    bpInputs?: Record<string, string>;
    smartPlusOverrides?: any; // SmartPlusConfig
  }
): Promise<{ historyId?: number; localImageUrl: string; localThumbnailUrl?: string } | undefined> => {
  // 将输入图片转换为 base64 保存
  let inputImageData: string | undefined;
  let inputImageName: string | undefined;
  let inputImageType: string | undefined;
  let inputImages: Array<{ data: string; name: string; type: string }> | undefined;

  // 保存所有输入图片（多图支持）
  if (inputFiles && inputFiles.length > 0) {
    try {
      inputImages = await Promise.all(inputFiles.map(async (file) => {
        const data = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });
        return {
          data,
          name: file.name, // Fixed: file.name
          type: file.type  // Fixed: file.type
        };
      }));

      // 保持向后兼容：第一张图片也保存到单图字段
      if (inputImages.length > 0) {
        inputImageData = inputImages[0].data;
        inputImageName = inputImages[0].name;
        inputImageType = inputImages[0].type;
      }
    } catch (e) {
      console.warn('保存输入图片失败:', e);
    }
  }

  const historyId = Date.now();

  // 先保存图片到本地output目录，获取本地URL
  let localImageUrl = imageUrl;
  let localThumbnailUrl: string | undefined;

  if (imageUrl.startsWith('data:')) {
    // base64 格式，直接保存
    try {
      const saveResult = await saveToOutput(imageUrl);
      if (saveResult.success && saveResult.data) {
        // 使用本地文件URL替代base64
        localImageUrl = saveResult.data.url;
      }
    } catch (e) {
      console.log('保存到output失败，使用base64:', e);
    }
  } else if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    // 远程 URL（贞贞 API 等返回），通过后端下载保存到本地防止过期（避免CORS问题）
    try {
      const downloadResult = await downloadRemoteToOutput(imageUrl);
      if (downloadResult.success && downloadResult.data) {
        localImageUrl = downloadResult.data.url;
        if (downloadResult.thumbnail) {
          // 捕獲縮略圖 URL
          localThumbnailUrl = downloadResult.thumbnail.url;
        }
        console.log('远程URL图片已保存到本地:', localImageUrl);
      } else {
        console.warn('后端下载远程图片失败:', downloadResult.error);
      }
    } catch (e) {
      console.log('下载远程图片失败，使用原始URL:', e);
    }
  }

  const historyItem: GenerationHistory = {
    id: historyId,
    imageUrl: localImageUrl, // 使用本地URL
    prompt: promptText,
    timestamp: Date.now(),
    model: isThirdParty ? (thirdPartyApiConfig.model || 'nano-banana-2') : 'Gemini 3 Pro',
    isThirdParty,
    inputImageData,
    inputImageName,
    inputImageType,
    inputImages, // 多图支持
    // 创意库信息
    creativeTemplateId: creativeInfo?.templateId,
    creativeTemplateType: creativeInfo?.templateType || 'none',
    bpInputs: creativeInfo?.bpInputs,
    smartPlusOverrides: creativeInfo?.smartPlusOverrides
  };

  try {
    const { id, ...historyWithoutId } = historyItem;
    // createHistory is defined in this file, so we can call it directly if it wasn't an export const.
    // Since it's exported, we can just call it.
    const result = await createHistory(historyWithoutId);
    if (result.success && result.data) {
      return { historyId: result.data.id, localImageUrl, localThumbnailUrl };
    }
    console.error('保存历史记录失败:', result.error);
  } catch (e) {
    console.error('保存历史记录失败:', e);
  }
  // 即使保存历史记录失败，也返回本地URL供桌面使用
  return { historyId: undefined, localImageUrl, localThumbnailUrl };
};
