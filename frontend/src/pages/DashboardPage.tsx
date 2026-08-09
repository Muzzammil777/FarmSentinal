import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  fetchSensorStatus,
  resetSensorAlert,
  fetchDetectionStatus,
  fetchControlStatus,
  controlLed,
  controlBuzzer,
  fetchSettings,
  updateSettings,
} from '../services/api';
import { SensorCard } from '../components/SensorCard';
import { CameraCard } from '../components/CameraCard';
import { DetectionCard } from '../components/DetectionCard';
import { ControlsCard } from '../components/ControlsCard';
import { AutoDetectionCard } from '../components/AutoDetectionCard';

export const DashboardPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Poll Sensor data every 500ms
  const { data: sensorStatus } = useQuery({
    queryKey: ['sensorStatus'],
    queryFn: fetchSensorStatus,
    refetchInterval: 500,
  });

  // Poll AI Detections every 500ms
  const { data: detectionStatus } = useQuery({
    queryKey: ['detectionStatus'],
    queryFn: fetchDetectionStatus,
    refetchInterval: 500,
  });

  // Poll Control states every 1000ms
  const { data: controlStatus } = useQuery({
    queryKey: ['controlStatus'],
    queryFn: fetchControlStatus,
    refetchInterval: 1000,
  });

  // Query Settings
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
  });

  // Reset Sensor Mutation
  const resetSensorMutation = useMutation({
    mutationFn: resetSensorAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sensorStatus'] });
      toast.success('ESP8266 Sensor alert distance reset');
    },
    onError: () => {
      toast.error('Failed to reset ESP8266 sensor');
    },
  });

  // Toggle LED Mutation
  const toggleLedMutation = useMutation({
    mutationFn: controlLed,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['controlStatus'] });
      toast.success(res.message);
    },
    onError: () => toast.error('Failed to toggle LED Flash'),
  });

  // Toggle Buzzer Mutation
  const toggleBuzzerMutation = useMutation({
    mutationFn: controlBuzzer,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['controlStatus'] });
      toast.success(res.message);
    },
    onError: () => toast.error('Failed to toggle Acoustic Siren'),
  });

  // Update Settings Mutation
  const updateSettingsMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Auto detection rule updated');
    },
    onError: () => toast.error('Failed to update settings'),
  });

  return (
    <div className="space-y-6">
      {/* Top Banner Alert if Intrusion Active */}
      {sensorStatus?.alert && (
        <div className="p-4 rounded-2xl bg-rose-100 border-2 border-rose-300 text-rose-950 flex items-center justify-between shadow-lg shadow-rose-500/10 animate-pulse">
          <div className="flex items-center space-x-3">
            <span className="text-3xl">🚨</span>
            <div>
              <h4 className="font-black text-rose-950 text-base">PROXIMITY INTRUSION ALERT DETECTED</h4>
              <p className="text-xs font-semibold text-rose-800">
                ESP8266 ultrasonic sensor detected object within threshold distance ({sensorStatus.distance?.toFixed(1)} cm).
              </p>
            </div>
          </div>
          <button
            onClick={() => resetSensorMutation.mutate()}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-md transition-colors"
          >
            Clear Alert
          </button>
        </div>
      )}

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Live Camera Feed */}
        <div className="lg:col-span-2 space-y-6">
          <CameraCard settings={settings} />
          <AutoDetectionCard
            settings={settings}
            onUpdateSettings={(newSet) => updateSettingsMutation.mutate(newSet)}
          />
        </div>

        {/* Right 1 Column: Sensor Status, Detection Hero, Hardware Controls */}
        <div className="space-y-6">
          <DetectionCard detection={detectionStatus} />
          <SensorCard
            sensorData={sensorStatus}
            onResetSensor={() => resetSensorMutation.mutate()}
            isResetting={resetSensorMutation.isPending}
          />
          <ControlsCard
            controlStatus={controlStatus}
            onToggleLed={(state) => toggleLedMutation.mutate(state)}
            onToggleBuzzer={(state) => toggleBuzzerMutation.mutate(state)}
            isPendingLed={toggleLedMutation.isPending}
            isPendingBuzzer={toggleBuzzerMutation.isPending}
          />
        </div>
      </div>
    </div>
  );
};
