// RunningHub 核心類型定義

export interface ApiResponse<T> {
    code: number;
    msg: string;
    data: T;
}

export interface NodeInfo {
    nodeId: string;
    nodeName: string;
    fieldName: string;
    fieldValue: string;
    fieldType: 'IMAGE' | 'AUDIO' | 'VIDEO' | 'STRING' | 'INT' | 'FLOAT' | 'LIST' | 'SWITCH';
    description?: string;
    fieldData?: string; // Options for LIST types
}

export interface UploadData {
    fileName: string;
    fileType: string;
}

export interface SubmitTaskData {
    taskId: string;
    promptTips?: string;
}

export interface TaskOutput {
    fileUrl: string;
    fileType?: string;
}

export interface HistoryItem {
    id: string;
    remoteTaskId?: string;
    timestamp: number;
    startTime: number;
    endTime?: number;
    appName?: string;
    appId?: string;
    error?: string;
    outputs: TaskOutput[];
    status: 'SUCCESS' | 'FAILED';
}

export interface TaskFailedReason {
    node_name: string;
    exception_message: string;
    exception_type?: string;
    traceback: string;
}

export interface TaskStatusData {
    status: string;
    failedReason?: TaskFailedReason;
    fileUrl?: string;
}

export interface TaskOutputResponse {
    outputs?: TaskOutput[];
    failedReason?: TaskFailedReason;
}

export enum AppStep {
    CONFIG = 0,
    EDITOR = 1,
    RUNNING = 2,
    RESULT = 3,
}

export interface PromptTips {
    result: boolean;
    error: string | null;
    node_errors: Record<string, string>;
}

export interface Favorite {
    name: string;
    webappId: string;
}

export interface AccountInfo {
    remainCoins: string;
    currentTaskCounts: string;
    remainMoney: string | null;
    currency: string | null;
    apiType: string;
}

export interface AutoSaveConfig {
    enabled: boolean;
    directoryName: string | null;
}

export interface AppPoolItem {
    id: string;
    name: string;
    intro?: string;
    thumbnailUrl?: string;
    owner?: {
        name: string;
        avatar: string;
    };
    useCount?: number;
    addedAt?: number;
    isLocalFavorite?: boolean;
    webappId?: string;
    coverStyle?: string;
}

export interface InstalledApp {
    id: string;
    webappId: string;
    name: string;
    coverStyle: string;
    description?: string;
    createdAt: number;
}

export interface AppConfig {
    apiKey: string;
    autoSave: AutoSaveConfig;
}

export type TaskStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'QUEUED';

export interface BackgroundTask {
    id: string;
    remoteTaskId?: string;
    appId: string;
    appName: string;
    status: TaskStatus;
    progress: number;
    startTime: number;
    endTime?: number;
    params: NodeInfo[];
    batchIndex?: number;
    totalBatch?: number;
    result?: TaskOutput[];
    error?: string;
    apiKey?: string;
    webappId?: string;
    queuePosition?: number;
    costCoins?: string;
    costMoney?: string;
}

export type FileType = 'image' | 'video' | 'audio' | 'unknown';

export interface UserFriendlyError {
    title: string;
    message: string;
    suggestion?: string;
    originalError?: string;
}

export interface FavoriteAppInfo {
    id: string;
    name: string;
    intro: string;
    thumbnailUrl: string;
    owner: {
        name: string;
        avatar: string;
    };
    useCount: number;
}

// RunningHub API 狀態碼
export const API_CODE = {
    SUCCESS: 0,
    RUNNING: 804,
    FAILED: 805,
    QUEUED: 813,
    QUEUE_MAXED: 806,
} as const;
