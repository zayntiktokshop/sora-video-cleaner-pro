
export enum TaskStatus {
  IDLE = 'IDLE',
  SUBMITTING = 'SUBMITTING',
  PROCESSING = 'PROCESSING',
  DOWNLOADING = 'DOWNLOADING',
  CLEANING = 'CLEANING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export interface KieTaskResponse {
  code: number;
  data: {
    taskId: string;
    status: string;
    results?: Array<{ url: string }> | { url?: string; video_url?: string };
    error?: string;
  };
}

export interface ProcessLog {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}
