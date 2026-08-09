import React, { useState, useRef } from 'react';
import { Camera, Maximize2, RefreshCw, Video, AlertCircle, Eye } from 'lucide-react';
import { AppSettings } from '../types';
import { API_BASE } from '../services/api';

interface CameraCardProps {
  settings?: AppSettings;
}

export const CameraCard: React.FC<CameraCardProps> = ({ settings }) => {
  const [hasError, setHasError] = useState(false);
  const [key, setKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleRefreshStream = () => {
    setHasError(false);
    setKey((prev) => prev + 1);
  };

  const handleToggleFullscreen = () => {
    if (containerRef.current) {
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen().catch(err => {
          console.error("Error attempting to enable fullscreen:", err);
        });
      } else {
        document.exitFullscreen();
      }
    }
  };

  const sourceLabel = settings?.camera_source === 'esp' 
    ? `ESP32-CAM (${settings.camera_ip}:81)`
    : settings?.camera_source === 'webcam'
    ? 'Local USB Webcam'
    : 'Synthetic Farm Simulation';

  return (
    <div className="glass-card p-6 glass-card-hover relative">
      {/* Header Bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-2xl bg-emerald-100 text-emerald-700">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-emerald-950 text-lg">Live Farm AI Vision Stream</h3>
            <p className="text-xs text-emerald-700/80">Continuous YOLOv8 Nano inference &amp; species HUD</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <Video className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span>{sourceLabel}</span>
          </span>

          <button
            onClick={handleRefreshStream}
            title="Reload Video Stream"
            className="p-2 rounded-xl bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200 transition-colors shadow-xs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleToggleFullscreen}
            title="Expand Fullscreen"
            className="p-2 rounded-xl bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200 transition-colors shadow-xs"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Video Display Box */}
      <div
        ref={containerRef}
        className="relative aspect-video w-full rounded-2xl overflow-hidden bg-slate-900 border-2 border-emerald-600/30 shadow-xl flex items-center justify-center group"
      >
        {!hasError ? (
          <img
            key={key}
            src={`${API_BASE}/video?stream_key=${key}`}
            alt="FarmSentinal Live Video Feed"
            onError={() => setHasError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="p-8 text-center flex flex-col items-center space-y-3 bg-emerald-950/80">
            <AlertCircle className="w-12 h-12 text-amber-400 animate-bounce" />
            <h4 className="text-lg font-bold text-white">Camera Feed Unavailable</h4>
            <p className="text-sm text-emerald-200 max-w-md">
              Unable to receive stream. Please check Camera IP in Settings. Backend is retrying automatically.
            </p>
            <button
              onClick={handleRefreshStream}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors shadow-md"
            >
              Retry Stream Connection
            </button>
          </div>
        )}

        {/* Live Indicator Overlay */}
        <div className="absolute top-3 left-3 flex items-center space-x-2 px-3 py-1 rounded-lg bg-emerald-950/80 backdrop-blur-sm border border-emerald-500/40 text-xs font-mono font-bold text-emerald-300 shadow-md">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>LIVE FARM FEED • 640x480</span>
        </div>
      </div>
    </div>
  );
};
