import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Save, Settings, Video, Wifi, RefreshCw, Cpu, CheckCircle } from 'lucide-react';
import { fetchSettings, updateSettings } from '../services/api';
import { AppSettings } from '../types';

export const SettingsPage: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: initialSettings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  });

  const [formData, setFormData] = useState<AppSettings>({
    esp8266_ip: '10.82.146.10',
    camera_ip: '10.82.146.44',
    polling_interval_ms: 500,
    selected_animal: 'cow',
    auto_mode: true,
    confidence_threshold: 0.70,
    camera_source: 'demo',
    simulation_mode: true,
  });

  useEffect(() => {
    if (initialSettings) {
      setFormData(initialSettings);
    }
  }, [initialSettings]);

  const saveMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('System configuration saved successfully!');
    },
    onError: () => toast.error('Failed to save settings'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-emerald-800 flex flex-col items-center space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
        <p className="font-bold">Loading system configuration settings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-3 rounded-2xl bg-emerald-100 text-emerald-700 border border-emerald-300">
          <Settings className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-emerald-950">System &amp; Network Configuration</h2>
          <p className="text-sm font-semibold text-emerald-700/80">Configure ESP hardware IP endpoints, polling parameters, and video sources</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Network IP Endpoints */}
        <div className="glass-card p-6 space-y-6">
          <h3 className="text-lg font-bold text-emerald-950 flex items-center space-x-2 border-b border-emerald-200/80 pb-3">
            <Wifi className="w-5 h-5 text-emerald-600" />
            <span>Hardware Network Addresses</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* ESP32 Camera IP */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-emerald-900">
                XIAO ESP32S3 Camera IP
              </label>
              <input
                type="text"
                value={formData.camera_ip}
                onChange={(e) => setFormData({ ...formData, camera_ip: e.target.value })}
                placeholder="10.82.146.44"
                className="w-full bg-emerald-50/50 border border-emerald-300 text-emerald-950 font-bold rounded-xl px-4 py-2.5 text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
              <p className="text-xs text-emerald-700/80 font-medium">HTTP Control Port 80, Stream Port 81</p>
            </div>

            {/* ESP8266 IP */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-emerald-900">
                ESP8266 Ultrasonic Sensor IP
              </label>
              <input
                type="text"
                value={formData.esp8266_ip}
                onChange={(e) => setFormData({ ...formData, esp8266_ip: e.target.value })}
                placeholder="10.82.146.10"
                className="w-full bg-emerald-50/50 border border-emerald-300 text-emerald-950 font-bold rounded-xl px-4 py-2.5 text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
              <p className="text-xs text-emerald-700/80 font-medium">Endpoints: /status, /data, /reset</p>
            </div>
          </div>

          {/* Polling Interval */}
          <div className="space-y-2 pt-2">
            <label className="block text-sm font-bold text-emerald-900">
              Sensor Polling Interval (ms)
            </label>
            <input
              type="number"
              min="100"
              max="5000"
              step="100"
              value={formData.polling_interval_ms}
              onChange={(e) => setFormData({ ...formData, polling_interval_ms: parseInt(e.target.value) || 500 })}
              className="w-full md:w-1/2 bg-emerald-50/50 border border-emerald-300 text-emerald-950 font-bold rounded-xl px-4 py-2.5 text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
            <p className="text-xs text-emerald-700/80 font-medium">Recommended: 500 ms for real-time telemetry</p>
          </div>
        </div>

        {/* Video Source Selector */}
        <div className="glass-card p-6 space-y-6">
          <h3 className="text-lg font-bold text-emerald-950 flex items-center space-x-2 border-b border-emerald-200/80 pb-3">
            <Video className="w-5 h-5 text-emerald-600" />
            <span>Camera Video Source Selection</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label
              className={`p-4 rounded-2xl border cursor-pointer flex flex-col justify-between space-y-3 transition-all ${
                formData.camera_source === 'esp'
                  ? 'bg-emerald-100/90 border-emerald-500 text-emerald-950 shadow-md'
                  : 'bg-white/80 border-emerald-200 text-emerald-900 hover:border-emerald-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <input
                  type="radio"
                  name="camera_source"
                  value="esp"
                  checked={formData.camera_source === 'esp'}
                  onChange={() => setFormData({ ...formData, camera_source: 'esp' })}
                  className="accent-emerald-600"
                />
                <span className="text-xs font-black uppercase text-emerald-800">Physical Hardware</span>
              </div>
              <div>
                <h4 className="font-black text-emerald-950 text-sm">ESP32 Camera Stream</h4>
                <p className="text-xs text-emerald-700 mt-1 font-medium">Fetch from http://{formData.camera_ip}:81</p>
              </div>
            </label>

            <label
              className={`p-4 rounded-2xl border cursor-pointer flex flex-col justify-between space-y-3 transition-all ${
                formData.camera_source === 'webcam'
                  ? 'bg-emerald-100/90 border-emerald-500 text-emerald-950 shadow-md'
                  : 'bg-white/80 border-emerald-200 text-emerald-900 hover:border-emerald-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <input
                  type="radio"
                  name="camera_source"
                  value="webcam"
                  checked={formData.camera_source === 'webcam'}
                  onChange={() => setFormData({ ...formData, camera_source: 'webcam' })}
                  className="accent-emerald-600"
                />
                <span className="text-xs font-black uppercase text-emerald-800">USB Hardware</span>
              </div>
              <div>
                <h4 className="font-black text-emerald-950 text-sm">Local System Webcam</h4>
                <p className="text-xs text-emerald-700 mt-1 font-medium">OpenCV cv2.VideoCapture(0)</p>
              </div>
            </label>

            <label
              className={`p-4 rounded-2xl border cursor-pointer flex flex-col justify-between space-y-3 transition-all ${
                formData.camera_source === 'demo'
                  ? 'bg-emerald-100/90 border-emerald-500 text-emerald-950 shadow-md'
                  : 'bg-white/80 border-emerald-200 text-emerald-900 hover:border-emerald-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <input
                  type="radio"
                  name="camera_source"
                  value="demo"
                  checked={formData.camera_source === 'demo'}
                  onChange={() => setFormData({ ...formData, camera_source: 'demo' })}
                  className="accent-emerald-600"
                />
                <span className="text-xs font-black uppercase text-emerald-800">Synthetic Demo</span>
              </div>
              <div>
                <h4 className="font-black text-emerald-950 text-sm">Farm Simulation Stream</h4>
                <p className="text-xs text-emerald-700 mt-1 font-medium">Built-in animated animal demo feed</p>
              </div>
            </label>
          </div>
        </div>

        {/* Hardware Simulation Mode Toggle */}
        <div className="glass-card p-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-emerald-100 text-emerald-700">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-black text-emerald-950 text-base">Hardware Simulation Mode</h4>
              <p className="text-xs font-semibold text-emerald-700/80">
                Allows testing dashboard telemetry &amp; controls seamlessly even when ESP physical devices are offline
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.simulation_mode}
              onChange={(e) => setFormData({ ...formData, simulation_mode: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-600 shadow-inner"></div>
          </label>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="flex items-center space-x-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm transition-all shadow-lg shadow-emerald-600/25 disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            <span>{saveMutation.isPending ? 'Saving Config...' : 'Save Configuration'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
