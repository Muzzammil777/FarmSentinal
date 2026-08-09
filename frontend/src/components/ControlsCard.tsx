import React from 'react';
import { Sliders, Zap, Volume2, Power } from 'lucide-react';
import { HardwareControlStatus } from '../types';

interface ControlsCardProps {
  controlStatus: HardwareControlStatus | undefined;
  onToggleLed: (state: boolean) => void;
  onToggleBuzzer: (state: boolean) => void;
  isPendingLed: boolean;
  isPendingBuzzer: boolean;
}

export const ControlsCard: React.FC<ControlsCardProps> = ({
  controlStatus,
  onToggleLed,
  onToggleBuzzer,
  isPendingLed,
  isPendingBuzzer,
}) => {
  const ledOn = controlStatus?.led ?? false;
  const buzzerOn = controlStatus?.buzzer ?? false;

  return (
    <div className="glass-card p-6 glass-card-hover">
      <div className="flex items-center space-x-3 mb-4">
        <div className="p-2.5 rounded-2xl bg-amber-100 text-amber-700">
          <Sliders className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-emerald-950 text-lg">Hardware Deterrent Controls</h3>
          <p className="text-xs text-emerald-700/80">Manual override for ESP32 Flash LED &amp; Acoustic Siren</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
        {/* LED Flash Control */}
        <div className="p-4 rounded-2xl bg-white border border-emerald-200/80 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Zap className={`w-5 h-5 ${ledOn ? 'text-amber-500 animate-pulse' : 'text-slate-400'}`} />
              <span className="font-bold text-emerald-950 text-sm">LED Flash</span>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                ledOn ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {ledOn ? 'ACTIVE (ON)' : 'OFF'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onToggleLed(true)}
              disabled={isPendingLed || ledOn}
              className="flex items-center justify-center space-x-1 py-2 px-3 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-600 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-amber-500/20"
            >
              <Power className="w-3.5 h-3.5" />
              <span>LED ON</span>
            </button>
            <button
              onClick={() => onToggleLed(false)}
              disabled={isPendingLed || !ledOn}
              className="flex items-center justify-center space-x-1 py-2 px-3 rounded-xl text-xs font-black bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>LED OFF</span>
            </button>
          </div>
        </div>

        {/* Acoustic Buzzer Control */}
        <div className="p-4 rounded-2xl bg-white border border-emerald-200/80 shadow-xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Volume2 className={`w-5 h-5 ${buzzerOn ? 'text-rose-600 animate-bounce' : 'text-slate-400'}`} />
              <span className="font-bold text-emerald-950 text-sm">Acoustic Buzzer</span>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                buzzerOn ? 'bg-rose-100 text-rose-900 border border-rose-300' : 'bg-slate-100 text-slate-500'
              }`}
            >
              {buzzerOn ? 'SOUNDING (ON)' : 'OFF'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onToggleBuzzer(true)}
              disabled={isPendingBuzzer || buzzerOn}
              className="flex items-center justify-center space-x-1 py-2 px-3 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-rose-600/20"
            >
              <Power className="w-3.5 h-3.5" />
              <span>BUZZER ON</span>
            </button>
            <button
              onClick={() => onToggleBuzzer(false)}
              disabled={isPendingBuzzer || !buzzerOn}
              className="flex items-center justify-center space-x-1 py-2 px-3 rounded-xl text-xs font-black bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>BUZZER OFF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
