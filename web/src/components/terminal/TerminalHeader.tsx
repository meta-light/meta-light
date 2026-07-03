'use client';
import { useState, useEffect } from 'react';

export default function TerminalHeader() {
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    setCurrentTime(new Date());
    setSessionId(Math.floor(Math.random() * 10000));
    const timer = setInterval(() => {setCurrentTime(new Date());}, 1000);
    return () => clearInterval(timer);
  }, []);
  if (!mounted) {
    return (
      <div className="bg-gray-900 border-b border-green-400 px-4 py-2 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <span className="text-green-400 font-bold">CARP-TERMINAL v1.0</span>
          <span className="text-green-300">●</span>
          <span className="text-sm">CONNECTED</span>
        </div>
        <div className="flex items-center space-x-6">
          <span className="text-sm">--/--/---- --:--:-- --</span>
          <span className="text-sm">UTC: --:--:--</span>
          <span className="text-sm">Session: ----</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border-b border-green-400 px-4 py-2 flex justify-between items-center">
      <div className="flex items-center space-x-4">
        <span className="text-green-400 font-bold">CARP-TERMINAL v1.0</span>
        <span className="text-green-300">●</span>
        <span className="text-sm">CONNECTED</span>
      </div>
      <div className="flex items-center space-x-6">
        <span className="text-sm">
          {currentTime ? 
            `${currentTime.toLocaleDateString()} ${currentTime.toLocaleTimeString()}` :
            '--/--/---- --:--:-- --'
          }
        </span>
        <span className="text-sm">
          UTC: {currentTime ? currentTime.toUTCString().split(' ')[4] : '--:--:--'}
        </span>
        <span className="text-sm">Session: {sessionId || '----'}</span>
      </div>
    </div>
  );
} 