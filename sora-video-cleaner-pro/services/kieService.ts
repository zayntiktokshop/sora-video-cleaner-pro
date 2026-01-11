
import { KieTaskResponse } from '../types';

const BASE_URL = 'https://api.kie.ai/api/v1';

/**
 * 提交视频处理任务
 */
export const submitTask = async (apiKey: string, videoUrl: string): Promise<string> => {
  const cleanKey = apiKey.trim();
  const cleanUrl = videoUrl.trim();

  const response = await fetch(`${BASE_URL}/jobs/createTask`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cleanKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'sora-watermark-remover',
      input: { video_url: cleanUrl }
    })
  });

  const data: any = await response.json();
  
  // 核心优化：捕获余额不足等特定业务错误
  if (data && (data.code === 200 || data.taskId) && (data.data?.taskId || data.taskId)) {
    return data.data?.taskId || data.taskId;
  }
  
  // 识别特定错误文本
  const errorMsg = data.msg || data.message || '';
  if (errorMsg.toLowerCase().includes('credits insufficient') || errorMsg.includes('insufficient')) {
    throw new Error('账户额度不足：请前往 kie.ai 充值后再试。');
  }
  
  throw new Error(errorMsg || `请求拒绝 (Code: ${data.code})`);
};

/**
 * 轮询任务状态及结果
 * 根据最新文档，接口已更新为 /jobs/recordInfo
 */
export const pollTask = async (apiKey: string, taskId: string): Promise<string> => {
  try {
    // 使用最新的查询接口 recordInfo
    const response = await fetch(`${BASE_URL}/jobs/recordInfo?taskId=${taskId.trim()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Accept': 'application/json'
      }
    });

    const data: any = await response.json();
    if (!data) return '';

    // 状态探测
    if (data.code !== undefined && data.code !== 200 && data.code !== 0) {
        const msg = (data.msg || data.message || '').toLowerCase();
        // 如果是任务未找到，可能还在入库中，不直接抛错
        if (msg.includes('fail') || msg.includes('error')) {
            throw new Error(data.msg || data.message || `查询失败: ${data.code}`);
        }
        return ''; 
    }

    const taskData = data.data || data;
    if (!taskData) return '';

    // 文档定义状态：waiting, queuing, generating, success, fail
    const rawState = taskData.state || taskData.status || '';
    const state = String(rawState).toLowerCase();

    // 成功分支
    if (state === 'success') {
      let finalUrl = '';
      
      // 文档明确指出结果在 resultJson 字符串中
      if (taskData.resultJson) {
        try {
          const parsed = typeof taskData.resultJson === 'string' ? JSON.parse(taskData.resultJson) : taskData.resultJson;
          // 文档结构示例：{"resultUrls":["https://..."]}
          finalUrl = parsed.resultUrls?.[0] || parsed.url || parsed.video_url || '';
        } catch (e) { 
          console.warn("resultJson 解析失败，尝试备选路径"); 
        }
      }

      // 备选兼容路径
      if (!finalUrl && taskData.results) {
        if (Array.isArray(taskData.results)) {
          const first = taskData.results[0];
          finalUrl = typeof first === 'string' ? first : (first?.url || first?.video_url || '');
        } else if (typeof taskData.results === 'object') {
          finalUrl = taskData.results.url || taskData.results.video_url || '';
        }
      }
      
      if (!finalUrl) finalUrl = taskData.url || taskData.video_url || '';

      if (finalUrl && String(finalUrl).startsWith('http')) return finalUrl;
      return ''; 
    }

    // 失败分支
    if (state === 'fail') {
      throw new Error(taskData.failMsg || taskData.error || '云端生成失败 (fail)');
    }

    // 其余状态 (waiting, queuing, generating) 返回空字符串继续轮询
    return '';
  } catch (err: any) {
    throw err;
  }
};
