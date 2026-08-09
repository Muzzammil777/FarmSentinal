import React, { useState, useEffect } from 'react';
import { Radio, AlertTriangle, RefreshCw, CheckCircle2, WifiOff, Sprout } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { SensorStatus } from '../types';

interface SensorCardProps {
  sensorData: SensorStatus | undefined;
  onResetSensor: () => void;
  isResetting: boolean;
}

interface DistancePoint {
  time: string;
  distance: number;
}

export const SensorCard: React.FC<SensorCardProps> = ({ sensorData, onResetSensor, isResetting }) => {
  const [history, setHistory] = useState<DistancePoint[]>([]);

  useEffect(() => {
    if (sensorData && sensorData.distance !== null) {
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setHistory((prev) => {
        const updated = [...prev, { time: now, distance: sensorData.distance! }];
        if (updated.length > 20) return updated.slice(updated.length - 20);
        return updated;
      });
    }
  }, [sensorData?.distance]);

  const isAlert = sensorData?.alert ?? false;
  const isOnline = sensorData?.online ?? false;
  const distance = sensorData?.distance;

  return (
    <div
      className={`glass-card p-6 relative overflow-hidden transition-all duration-300 ${
        isAlert ? 'alert-pulse-card' : 'glass-card-hover'
      }`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`p-2.5 rounded-2xl ${isAlert ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-700'}`}>
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-bold text-emerald-950 text-lg">ESP8266 Proximity Sensor</h3>
            <p className="text-xs text-emerald-700/80">Ultrasonic farm boundary telemetry (&le; 45cm alert)</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Status Badge */}
          {isOnline ? (
            <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Online</span>
            </span>
          ) : (
            <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
              <WifiOff className="w-3.5 h-3.5 text-rose-600" />
              <span>Offline</span>
            </span>
          )}

          {/* Reset Button */}
          <button
            onClick={onResetSensor}
            disabled={isResetting}
            title="Reset Frozen Alert Distance on ESP8266"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Main Metric Display */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center my-4">
        <div className="p-4 rounded-2xl bg-white border border-emerald-200/80 shadow-xs">
          <div className="text-xs font-bold text-emerald-800/80 uppercase tracking-wider mb-1">Measured Distance</div>
          <div className="flex items-baseline space-x-2">
            <span className="text-4xl font-black tracking-tight text-emerald-950">
              {distance !== null && distance !== undefined ? distance.toFixed(1) : '--'}
            </span>
            <span className="text-emerald-700 font-bold">cm</span>
          </div>
        </div>

        <div className={`p-4 rounded-2xl border ${isAlert ? 'bg-rose-100/90 border-rose-300' : 'bg-emerald-50 border-emerald-200'}`}>
          <div className="text-xs font-bold text-emerald-900/80 uppercase tracking-wider mb-1">Boundary Status</div>
          <div className="flex items-center space-x-2">
            {isAlert ? (
              <>
                <AlertTriangle className="w-6 h-6 text-rose-600 animate-bounce" />
                <span className="text-lg font-black text-rose-700">ALERT TRIGGERED</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                <span className="text-lg font-black text-emerald-800">Clear & Safe</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Distance Telemetry Chart */}
      <div className="mt-4 pt-4 border-t border-emerald-200/60">
        <div className="text-xs font-bold text-emerald-800 mb-2 flex items-center justify-between">
          <span className="flex items-center space-x-1">
            <Sprout className="w-3.5 h-3.5 text-emerald-600" />
            <span>Live Telemetry Trend (Last 20 readings)</span>
          </span>
          <span className="text-[10px] text-emerald-600 font-medium">Alert Threshold: 45 cm</span>
        </div>
        <div className="h-28 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="distGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isAlert ? '#e11d48' : '#059669'} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={isAlert ? '#e11d48' : '#059669'} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" tick={{ fill: '#047857', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: '#047857', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#ffffff', borderColor: '#a7f3d0', borderRadius: '0.75rem', color: '#064e3b', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                labelStyle={{ color: '#047857', fontWeight: 'bold' }}
              />
              <Area
                type="monotone"
                dataKey="distance"
                stroke={isAlert ? '#e11d48' : '#059669'}
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#distGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
