import React, { useEffect, useState, useRef, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [fadeOut, setFadeOut] = useState(false);
  const [status, setStatus] = useState('Starting...');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasCompletedRef = useRef(false);
  const startTimeRef = useRef(Date.now());

  const finishSplash = useCallback(() => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    
    // Clear any polling
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    
    setStatus('Ready!');
    
    // Ensure minimum 2.5 second display
    const elapsed = Date.now() - startTimeRef.current;
    const minDisplayTime = 2500;
    const remainingTime = Math.max(0, minDisplayTime - elapsed);
    
    setTimeout(() => {
      setFadeOut(true);
      setTimeout(onComplete, 500);
    }, remainingTime);
  }, [onComplete]);

  useEffect(() => {
    const checkBackend = async (): Promise<boolean> => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        
        const response = await fetch(`${API_URL}/health`, {
          method: 'GET',
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          return data.status === 'healthy';
        }
        return false;
      } catch {
        return false;
      }
    };

    const checkData = async (): Promise<boolean> => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        
        const today = new Date().toISOString().split('T')[0];
        const response = await fetch(`${API_URL}/api/notes/${today}`, {
          method: 'GET',
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        return response.ok || response.status === 404;
      } catch {
        return false;
      }
    };

    const poll = async () => {
      if (hasCompletedRef.current) return;
      
      const healthy = await checkBackend();
      if (!healthy) {
        setStatus('Waiting for backend...');
        return;
      }
      
      setStatus('Loading data...');
      const dataReady = await checkData();
      if (dataReady) {
        finishSplash();
      }
    };

    // Start polling after a brief delay
    const initialTimeout = setTimeout(poll, 200);
    pollingRef.current = setInterval(poll, 500);

    return () => {
      clearTimeout(initialTimeout);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [finishSplash]);

  return (
    <div
      className={`fixed inset-0 flex flex-col items-center justify-center transition-opacity duration-500 ${
        fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #020617 100%)',
        zIndex: 9999,
      }}
    >
      {/* Logo Container */}
      <div className="flex flex-col items-center space-y-8">
        {/* TtT Logo with Animation */}
        <div className="relative animate-pulse">
          <svg
            width="180"
            height="120"
            viewBox="0 0 240 160"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-2xl"
          >
            {/* Rounded rectangle border */}
            <rect
              x="12"
              y="12"
              width="216"
              height="136"
              rx="20"
              stroke="#3b82f6"
              strokeWidth="12"
              fill="none"
              className="animate-pulse"
            />
            {/* TtT Text */}
            <text
              x="120"
              y="90"
              fontFamily="Arial, sans-serif"
              fontSize="90"
              fontWeight="bold"
              fill="#3b82f6"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              TtT
            </text>
            {/* Bottom decoration */}
            <rect
              x="90"
              y="130"
              width="60"
              height="20"
              rx="10"
              fill="#3b82f6"
            />
          </svg>
          
          {/* Glow effect */}
          <div className="absolute inset-0 blur-2xl opacity-30 bg-blue-500 rounded-full" />
        </div>

        {/* App Name */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-white tracking-tight">
            Track the Thing
          </h1>
        </div>

        {/* Loading indicator */}
        <div className="flex flex-col items-center space-y-3">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <p className="text-blue-200 text-sm">{status}</p>
        </div>
      </div>

      {/* Version footer */}
      <div className="absolute bottom-8 text-gray-400 text-sm">
        Version 0.1.0
      </div>
    </div>
  );
};

