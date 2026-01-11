
import React, { useState, useCallback, useRef } from 'react';
import { TaskStatus, ProcessLog } from './types';
import { submitTask, pollTask } from './services/kieService';
import Logger from './components/Logger';

declare global {
  interface Window {
    FFmpeg: any;
  }
}

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [status, setStatus] = useState<TaskStatus>(TaskStatus.IDLE);
  const [logs, setLogs] = useState<ProcessLog[]>([]);
  const [cloudVideoUrl, setCloudVideoUrl] = useState<string | null>(null);
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  
  const activeTaskId = useRef<string | null>(null);
  const ffmpegRef = useRef<any>(null);
  const isFFmpegLoaded = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addLog = useCallback((message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setLogs(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
        message,
        type
      }
    ]);
  }, []);

  const runPhysicalCleaning = async () => {
    const source = localFile || cloudVideoUrl;
    if (!source) {
      addLog('未检测到视频源', 'error');
      return;
    }
    
    try {
      setStatus(TaskStatus.CLEANING);
      setProgress(0);
      addLog('🛡️ [核心引擎] 启动物理级脱敏...', 'info');

      if (!isFFmpegLoaded.current) {
        addLog('   ↳ 正在加载 WASM 核心...', 'info');
        const { createFFmpeg } = window.FFmpeg;
        
        // Vercel 部署环境下，即便有 Header，显式指定 corePath 也是最稳妥的做法
        ffmpegRef.current = createFFmpeg({ 
          log: true,
          corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
        });

        ffmpegRef.current.setProgress(({ ratio }: { ratio: number }) => {
          if (ratio >= 0) setProgress(Math.round(ratio * 100));
        });

        await ffmpegRef.current.load();
        isFFmpegLoaded.current = true;
        addLog('   ↳ WASM 引擎就绪。', 'success');
      }

      const ffmpeg = ffmpegRef.current;
      const { fetchFile } = window.FFmpeg;

      addLog('   ↳ 正在导入媒体流...', 'info');
      ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(source));

      addLog('   ↳ 执行深度脱敏指令...', 'warning');
      
      // 使用更稳健的参数：清除所有元数据 + 轻微像素噪点重构
      await ffmpeg.run(
        '-i', 'input.mp4',
        '-map_metadata', '-1',
        '-vf', 'noise=alls=1:allf=t,eq=contrast=1.01:saturation=1.01',
        '-c:v', 'libx264',
        '-crf', '24',
        '-preset', 'ultrafast',
        '-c:a', 'copy', // 保持音频以节省时间，如需音频脱敏可改为 'aac'
        'output.mp4'
      );

      const data = ffmpeg.FS('readFile', 'output.mp4');
      const blob = new Blob([data.buffer], { type: 'video/mp4' });
      const resultUrl = URL.createObjectURL(blob);
      
      setFinalVideoUrl(resultUrl);
      setStatus(TaskStatus.COMPLETED);
      addLog('🎉 物理脱敏成功！文件已净化并重构。', 'success');
      setProgress(100);

    } catch (error: any) {
      console.error(error);
      addLog(`❌ 引擎异常: ${error.message}`, 'error');
      setStatus(TaskStatus.FAILED);
    }
  };

  const handlePhase1 = async () => {
    if (!apiKey.trim() || !videoUrl.trim()) {
      addLog('配置错误: 请检查 API Key 或链接', 'error');
      return;
    }
    try {
      setStatus(TaskStatus.SUBMITTING);
      addLog('🚀 正在请求云端去水印...', 'info');
      const taskId = await submitTask(apiKey, videoUrl);
      addLog(`任务已提交: ${taskId}`, 'success');
      setStatus(TaskStatus.PROCESSING);
      
      let resultUrl = '';
      for(let i=0; i<60; i++) {
        await new Promise(r => setTimeout(r, 6000));
        resultUrl = await pollTask(apiKey, taskId);
        if (resultUrl) break;
        addLog(`云端同步中 (${(i+1)*6}s)...`, 'info');
        setProgress(Math.min(95, 10 + i * 1.5));
      }
      
      if (resultUrl) {
        setCloudVideoUrl(resultUrl);
        addLog('✅ 阶段一：云端去水印完成', 'success');
        setProgress(100);
      } else {
        throw new Error("云端处理超时，请稍后检查 Kie.ai 控制台");
      }
      setStatus(TaskStatus.IDLE);
    } catch (e: any) {
      addLog(e.message, 'error');
      setStatus(TaskStatus.FAILED);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLocalFile(file);
      setCloudVideoUrl(null);
      setFinalVideoUrl(null);
      addLog(`📁 本地文件载入: ${file.name}`, 'success');
    }
  };

  const reset = () => {
    setStatus(TaskStatus.IDLE);
    setCloudVideoUrl(null);
    setLocalFile(null);
    setFinalVideoUrl(null);
    setProgress(0);
    setLogs([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen py-20 px-6 lg:px-10">
      <nav className="fixed top-0 left-0 right-0 p-5 glass flex justify-between items-center z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <i className="fas fa-shield-alt text-white text-sm"></i>
          </div>
          <h1 className="font-black text-lg tracking-tighter uppercase">SoraCleaner <span className="text-blue-500 font-light">Vercel Edition</span></h1>
        </div>
        <div className={`text-[9px] font-bold px-3 py-1 rounded-full border uppercase tracking-widest transition-colors ${status === TaskStatus.COMPLETED ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}`}>
           STATUS: {status}
        </div>
      </nav>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 mt-12">
        <div className="space-y-6">
          <div className="glass p-8 rounded-[2rem] shadow-xl">
            <h2 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
              <i className="fas fa-cloud"></i> 模式 A：Sora 云端链接处理
            </h2>
            <div className="space-y-4">
              <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Kie.ai API Key" className="w-full bg-black/40 border border-white/5 p-4 rounded-2xl outline-none focus:border-blue-500/50 transition-all text-sm" />
              <input type="text" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="Sora Share Link" className="w-full bg-black/40 border border-white/5 p-4 rounded-2xl outline-none focus:border-blue-500/50 transition-all text-sm" />
              <button onClick={handlePhase1} disabled={status !== TaskStatus.IDLE} className="w-full bg-blue-600 p-4 rounded-2xl font-bold uppercase text-[10px] tracking-widest hover:bg-blue-500 transition-all disabled:opacity-30 shadow-lg shadow-blue-600/20">开始云端提取</button>
            </div>
          </div>

          <div className="glass p-8 rounded-[2rem] shadow-xl">
            <h2 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
              <i className="fas fa-upload"></i> 模式 B：本地视频深度脱敏
            </h2>
            <div onClick={() => fileInputRef.current?.click()} className="group border-2 border-dashed border-white/5 p-12 rounded-[1.5rem] text-center cursor-pointer hover:border-emerald-500/30 transition-all bg-black/20">
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="video/*" />
              <i className="fas fa-cloud-upload-alt text-2xl text-gray-700 group-hover:text-emerald-500/50 mb-3 transition-colors"></i>
              <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest break-all">
                {localFile ? localFile.name : '点击或拖拽上传视频文件'}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass p-8 rounded-[2rem] shadow-xl min-h-[450px] flex flex-col">
             <div className="flex justify-between items-center mb-6">
                <h2 className="font-black uppercase text-[10px] tracking-widest text-gray-400">实时处理管线</h2>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-black text-blue-500 tabular-nums">{progress}%</span>
                </div>
             </div>
             
             <div className="flex-grow">
               <Logger logs={logs} />
             </div>
             
             {(cloudVideoUrl || localFile) && !finalVideoUrl && (
               <div className="mt-6 p-6 bg-blue-500/5 border border-blue-500/10 rounded-2xl animate-in fade-in zoom-in duration-500">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">物理脱敏引擎已就绪</p>
                  </div>
                  <button onClick={runPhysicalCleaning} disabled={status === TaskStatus.CLEANING} className="w-full bg-blue-600 hover:bg-blue-500 p-4 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg shadow-blue-600/20">
                    执行深度脱敏 (RE-ENCODE)
                  </button>
               </div>
             )}

             {finalVideoUrl && (
               <div className="mt-6 space-y-4 animate-in slide-in-from-bottom-4 duration-500">
                 <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-4">✨ 脱敏处理已完成</p>
                    <video src={finalVideoUrl} controls className="w-full rounded-lg bg-black mb-4 shadow-xl" />
                    <div className="grid grid-cols-2 gap-3">
                      <a href={finalVideoUrl} download="cleaned_sora.mp4" className="bg-emerald-600 hover:bg-emerald-500 p-3 rounded-xl font-bold uppercase text-[9px] tracking-widest text-center transition-all shadow-lg shadow-emerald-600/20">下载结果</a>
                      <button onClick={reset} className="bg-white/5 hover:bg-white/10 p-3 rounded-xl font-bold uppercase text-[9px] tracking-widest text-gray-400 border border-white/5 transition-all">重置任务</button>
                    </div>
                 </div>
               </div>
             )}
          </div>
        </div>
      </div>
      
      <footer className="max-w-6xl mx-auto mt-12 text-center">
        <p className="text-[9px] font-bold text-gray-600 uppercase tracking-[0.4em]">Powered by Kie.ai & FFmpeg.WASM | Secure Processing Environment</p>
      </footer>
    </div>
  );
};

export default App;
