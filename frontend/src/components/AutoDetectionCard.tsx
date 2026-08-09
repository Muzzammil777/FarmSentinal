import React from 'react';
import { ShieldCheck, Bot, Check, SlidersHorizontal, Sprout } from 'lucide-react';
import { AppSettings, ANIMAL_CLASSES } from '../types';

interface AutoDetectionCardProps {
  settings: AppSettings | undefined;
  onUpdateSettings: (newSettings: AppSettings) => void;
}

export const AutoDetectionCard: React.FC<AutoDetectionCardProps> = ({
  settings,
  onUpdateSettings,
}) => {
  if (!settings) return null;

  const handleToggleAuto = () => {
    onUpdateSettings({
      ...settings,
      auto_mode: !settings.auto_mode,
    });
  };

  const handleSelectAnimal = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdateSettings({
      ...settings,
      selected_animal: e.target.value,
    });
  };

  const handleConfidenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateSettings({
      ...settings,
      confidence_threshold: parseFloat(e.target.value),
    });
  };

  const currentConfPercent = Math.round(settings.confidence_threshold * 100);

  return (
    <div className="glass-card p-6 glass-card-hover">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-2xl bg-emerald-100 text-emerald-700">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-emerald-950 text-lg">Automated Deterrent Rule Engine</h3>
            <p className="text-xs text-emerald-700/80">Configure AI trigger rules &amp; species matching thresholds</p>
          </div>
        </div>

        {/* Master Auto Toggle Switch */}
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={settings.auto_mode}
            onChange={handleToggleAuto}
            className="sr-only peer"
          />
          <div className="w-14 h-7 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-600 shadow-inner"></div>
          <span className="ml-3 text-xs font-black text-emerald-950">
            {settings.auto_mode ? 'AUTO ENABLED' : 'MANUAL'}
          </span>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {/* Target Animal Dropdown */}
        <div className="p-4 rounded-2xl bg-white border border-emerald-200/80 shadow-xs space-y-2">
          <label className="block text-xs font-bold text-emerald-800 uppercase tracking-wider">
            Target Intruder Animal Class
          </label>
          <select
            value={settings.selected_animal}
            onChange={handleSelectAnimal}
            className="w-full bg-emerald-50/60 border border-emerald-300 text-emerald-950 rounded-xl px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none cursor-pointer"
          >
            {ANIMAL_CLASSES.map((animal) => (
              <option key={animal.id} value={animal.id}>
                {animal.label}
              </option>
            ))}
          </select>
        </div>

        {/* Confidence Threshold Slider */}
        <div className="p-4 rounded-2xl bg-white border border-emerald-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-emerald-800 uppercase tracking-wider">Confidence Threshold</span>
            <span className="text-emerald-700 font-mono font-black text-sm">{currentConfPercent}%</span>
          </div>
          <input
            type="range"
            min="0.50"
            max="0.90"
            step="0.10"
            value={settings.confidence_threshold}
            onChange={handleConfidenceChange}
            className="w-full accent-emerald-600 h-2 bg-emerald-100 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-emerald-700 font-bold font-mono px-1">
            <span>50%</span>
            <span>60%</span>
            <span>70%</span>
            <span>80%</span>
            <span>90%</span>
          </div>
        </div>
      </div>

      {/* Logic Summary Banner */}
      <div className="mt-4 p-3.5 rounded-2xl bg-emerald-100/70 border border-emerald-300/80 text-xs text-emerald-900 flex items-center space-x-2.5 shadow-xs">
        <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" />
        <span>
          <strong>Automated Farm Rule:</strong> When {settings.selected_animal.toUpperCase()} is detected with &ge; {currentConfPercent}% confidence while Auto Mode is ON, the system will automatically trigger the ESP32 Flash LED &amp; Acoustic Siren.
        </span>
      </div>
    </div>
  );
};
