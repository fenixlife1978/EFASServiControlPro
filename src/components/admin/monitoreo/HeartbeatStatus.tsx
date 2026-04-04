'use client';

import React, { useState, useEffect } from 'react';
import { rtdb } from '@/firebase/config';
import { ref, onValue } from 'firebase/database';
import { Wifi, WifiOff, Clock, Activity } from 'lucide-react';

interface HeartbeatStatusProps {
  deviceId: string;
  compact?: boolean;
}

export function HeartbeatStatus({ deviceId, compact = false }: HeartbeatStatusProps) {
  const [online, setOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!deviceId) return;

    const statusRef = ref(rtdb, `status_dispositivos/${deviceId}`);
    
    const unsubscribe = onValue(statusRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setOnline(data.online === true);
        setLastSeen(data.lastSeen || data.heartbeat || null);
      } else {
        setOnline(false);
        setLastSeen(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [deviceId]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - timestamp;
    
    if (diff < 60000) return 'ahora';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min atrás`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h atrás`;
    return date.toLocaleDateString();
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        {online ? (
          <>
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[9px] text-green-500 font-mono">ONLINE</span>
          </>
        ) : (
          <>
            <div className="w-2 h-2 rounded-full bg-slate-600" />
            <span className="text-[9px] text-slate-500 font-mono">OFFLINE</span>
          </>
        )}
        {lastSeen && !online && (
          <span className="text-[8px] text-slate-600">
            ({formatTime(lastSeen)})
          </span>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <Activity className="w-3 h-3 text-slate-500 animate-pulse" />
        <span className="text-[10px] text-slate-500">Conectando...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {online ? (
        <>
          <Wifi className="w-3 h-3 text-green-500" />
          <span className="text-[10px] text-green-500 font-medium">Conectado</span>
        </>
      ) : (
        <>
          <WifiOff className="w-3 h-3 text-slate-500" />
          <span className="text-[10px] text-slate-500">
            Desconectado {lastSeen ? `desde ${formatTime(lastSeen)}` : ''}
          </span>
        </>
      )}
      {lastSeen && online && (
        <div className="flex items-center gap-1 text-slate-600">
          <Clock className="w-2.5 h-2.5" />
          <span className="text-[8px]">último heartbeat: {formatTime(lastSeen)}</span>
        </div>
      )}
    </div>
  );
}
