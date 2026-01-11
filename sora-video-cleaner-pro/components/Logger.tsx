
import React, { useEffect, useRef } from 'react';
import { ProcessLog } from '../types';

interface LoggerProps {
  logs: ProcessLog[];
}

const Logger: React.FC<LoggerProps> = ({ logs }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="glass-dark rounded-xl p-5 mono text-[11px] h-72 overflow-y-auto relative group" ref={scrollRef}>
      <div className="sticky top-0 bg-black/40 backdrop-blur flex items-center justify-between mb-3 border-b border-white/5 pb-2 -mt-2">
        <div className="flex items-center gap-2">
            <span className="flex gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/50"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/50"></div>
            </span>
            <span className="text-gray-400 font-medium ml-2">SYSTEM_OUTPUT</span>
        </div>
        <div className="text-[10px] text-gray-600 tracking-tighter">SECURE_CHANNEL_v2.0</div>
      </div>
      
      {logs.length === 0 && (
        <div className="text-gray-600 flex flex-col items-center justify-center h-full gap-2">
            <i className="fas fa-satellite-dish animate-pulse text-xl"></i>
            <span className="uppercase tracking-widest text-[9px]">Awaiting engine initialization...</span>
        </div>
      )}
      
      {logs.map((log) => (
        <div key={log.id} className="mb-1.5 flex gap-3 leading-relaxed animate-in fade-in duration-300">
          <span className="text-gray-600 whitespace-nowrap">[{log.timestamp}]</span>
          <span className={
            log.type === 'error' ? 'text-red-400 font-semibold' :
            log.type === 'success' ? 'text-emerald-400' :
            log.type === 'warning' ? 'text-amber-400' : 'text-blue-400'
          }>
            <span className="mr-2 opacity-50">{log.type === 'error' ? 'ERR' : log.type === 'success' ? 'OK ' : 'LOG'}</span>
            {log.message}
          </span>
        </div>
      ))}
      <style>{`
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
};

export default Logger;
